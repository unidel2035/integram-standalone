import apiClient from '@/axios2'

/**
 * Service for handling data export and import operations
 * Supports multiple formats: JSON, CSV, Excel, SQL
 * Includes GDPR compliance features
 *
 * Note: XLSX is dynamically imported only when needed (Issue #4324)
 * to reduce initial bundle size
 */
class ExportImportService {
  /**
   * Lazy load XLSX library
   * @returns {Promise<Object>} XLSX module
   */
  async _loadXLSX() {
    if (!this._xlsxModule) {
      this._xlsxModule = await import('xlsx')
    }
    return this._xlsxModule
  }
  /**
   * Request a full data export
   * @param {Object} options - Export options
   * @param {Array<string>} options.dataTypes - Types of data to export (e.g., ['tables', 'reports', 'documents'])
   * @param {string} options.format - Export format (json, csv, excel, sql)
   * @param {Object} options.filters - Optional filters (dateRange, customFields, etc.)
   * @param {boolean} options.includeMetadata - Include metadata in export
   * @param {boolean} options.includeAttachments - Include file attachments
   * @returns {Promise<Object>} Export job details with ID
   */
  async requestExport(options) {
    try {
      const response = await apiClient.post('/exports', {
        data_types: options.dataTypes || ['all'],
        format: options.format || 'json',
        filters: options.filters || {},
        include_metadata: options.includeMetadata !== false,
        include_attachments: options.includeAttachments !== false,
        gdpr_compliant: options.gdprCompliant || false,
      })
      return response.data
    } catch (error) {
      console.error('Export request failed:', error)
      throw error
    }
  }

  /**
   * Get export job status
   * @param {string} exportId - Export job ID
   * @returns {Promise<Object>} Export status and progress
   */
  async getExportStatus(exportId) {
    try {
      const response = await apiClient.get(`/exports/${exportId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get export status:', error)
      throw error
    }
  }

  /**
   * Download completed export
   * @param {string} exportId - Export job ID
   * @returns {Promise<Blob>} Export file blob
   */
  async downloadExport(exportId) {
    try {
      const response = await apiClient.get(`/exports/${exportId}/download`, {
        responseType: 'blob',
      })
      return response.data
    } catch (error) {
      console.error('Export download failed:', error)
      throw error
    }
  }

  /**
   * GDPR compliant - Request all user data
   * Generates a complete data export in machine-readable format
   * @returns {Promise<Object>} Export job details
   */
  async requestGDPRExport() {
    try {
      const response = await apiClient.post('/exports/gdpr', {
        format: 'json',
        include_all: true,
        gdpr_compliant: true,
      })
      return response.data
    } catch (error) {
      console.error('GDPR export request failed:', error)
      throw error
    }
  }

  /**
   * Upload file for import
   * @param {File} file - File to import
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import job details
   */
  async uploadImportFile(file, options = {}) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('dry_run', options.dryRun || false)
      formData.append('validate_only', options.validateOnly || false)

      const response = await apiClient.post('/imports', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    } catch (error) {
      console.error('Import upload failed:', error)
      throw error
    }
  }

  /**
   * Get import job status and validation results
   * @param {string} importId - Import job ID
   * @returns {Promise<Object>} Import status, progress, and validation errors
   */
  async getImportStatus(importId) {
    try {
      const response = await apiClient.get(`/imports/${importId}/status`)
      return response.data
    } catch (error) {
      console.error('Failed to get import status:', error)
      throw error
    }
  }

  /**
   * Confirm and execute import after validation
   * @param {string} importId - Import job ID
   * @param {Object} mapping - Field mapping configuration
   * @returns {Promise<Object>} Import execution result
   */
  async confirmImport(importId, mapping = {}) {
    try {
      const response = await apiClient.post(`/imports/${importId}/confirm`, {
        field_mapping: mapping,
      })
      return response.data
    } catch (error) {
      console.error('Import confirmation failed:', error)
      throw error
    }
  }

  /**
   * Cancel an ongoing import
   * @param {string} importId - Import job ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelImport(importId) {
    try {
      const response = await apiClient.post(`/imports/${importId}/cancel`)
      return response.data
    } catch (error) {
      console.error('Import cancellation failed:', error)
      throw error
    }
  }

  /**
   * Get list of recent exports
   * @param {number} limit - Number of exports to retrieve
   * @returns {Promise<Array>} List of recent exports
   */
  async getExportHistory(limit = 10) {
    try {
      const response = await apiClient.get('/exports', {
        params: { limit },
      })
      return response.data
    } catch (error) {
      console.error('Failed to get export history:', error)
      throw error
    }
  }

  /**
   * Get list of recent imports
   * @param {number} limit - Number of imports to retrieve
   * @returns {Promise<Array>} List of recent imports
   */
  async getImportHistory(limit = 10) {
    try {
      const response = await apiClient.get('/imports', {
        params: { limit },
      })
      return response.data
    } catch (error) {
      console.error('Failed to get import history:', error)
      throw error
    }
  }

  /**
   * Delete an export file
   * @param {string} exportId - Export job ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteExport(exportId) {
    try {
      const response = await apiClient.delete(`/exports/${exportId}`)
      return response.data
    } catch (error) {
      console.error('Export deletion failed:', error)
      throw error
    }
  }

  /**
   * Client-side export to CSV
   * @param {Array} data - Data to export
   * @param {string} filename - Output filename
   */
  async exportToCSV(data, filename = 'export.csv') {
    const XLSX = await this._loadXLSX()
    const ws = XLSX.utils.json_to_sheet(data)
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    this.downloadBlob(blob, filename)
  }

  /**
   * Client-side export to Excel
   * @param {Array} data - Data to export
   * @param {string} filename - Output filename
   */
  async exportToExcel(data, filename = 'export.xlsx') {
    const XLSX = await this._loadXLSX()
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, filename)
  }

  /**
   * Client-side export to JSON
   * @param {Object} data - Data to export
   * @param {string} filename - Output filename
   */
  exportToJSON(data, filename = 'export.json') {
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    this.downloadBlob(blob, filename)
  }

  /**
   * Helper to trigger file download
   * @param {Blob} blob - File blob
   * @param {string} filename - Output filename
   */
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  /**
   * Parse imported file on client side
   * @param {File} file - File to parse
   * @returns {Promise<Array>} Parsed data
   */
  async parseImportFile(file) {
    // Load XLSX only when parsing Excel/CSV files
    const XLSX = await this._loadXLSX()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = e => {
        try {
          const data = e.target.result

          if (file.name.endsWith('.json')) {
            resolve(JSON.parse(data))
          } else if (file.name.endsWith('.csv')) {
            const wb = XLSX.read(data, { type: 'string' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_json(ws))
          } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            const wb = XLSX.read(data, { type: 'binary' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            resolve(XLSX.utils.sheet_to_json(ws))
          } else {
            reject(new Error('Unsupported file format'))
          }
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = error => reject(error)

      if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
        reader.readAsText(file)
      } else {
        reader.readAsBinaryString(file)
      }
    })
  }

  /**
   * Schedule automated export
   * @param {Object} schedule - Schedule configuration
   * @returns {Promise<Object>} Scheduled export details
   */
  async scheduleExport(schedule) {
    try {
      const response = await apiClient.post('/exports/schedule', schedule)
      return response.data
    } catch (error) {
      console.error('Export scheduling failed:', error)
      throw error
    }
  }

  /**
   * Get scheduled exports list
   * @returns {Promise<Array>} List of scheduled exports
   */
  async getScheduledExports() {
    try {
      const response = await apiClient.get('/exports/scheduled')
      return response.data
    } catch (error) {
      console.error('Failed to get scheduled exports:', error)
      throw error
    }
  }

  /**
   * Delete a scheduled export
   * @param {string} scheduleId - Schedule ID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteScheduledExport(scheduleId) {
    try {
      const response = await apiClient.delete(`/exports/schedule/${scheduleId}`)
      return response.data
    } catch (error) {
      console.error('Scheduled export deletion failed:', error)
      throw error
    }
  }
}

export default new ExportImportService()
