import axios from 'axios'

/**
 * Document Processing Service
 *
 * Handles file uploads and AI-based document processing
 * for Customer Journey feature. Extracts structured data
 * from business documents using AI models.
 */

const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || '/api'

/**
 * Supported file types for document processing
 */
export const SUPPORTED_FILE_TYPES = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  DOC: 'application/msword',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  TXT: 'text/plain'
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MAX_FILES = 5

/**
 * Document Processing Service Class
 */
class DocumentProcessingService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000 // 60 seconds for large file processing
    })
  }

  /**
   * Validate file before upload
   *
   * @param {File} file - File object
   * @returns {Object} Validation result
   */
  validateFile(file) {
    const errors = []

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File "${file.name}" exceeds maximum size of 10 MB`)
    }

    // Check file type
    const supportedTypes = Object.values(SUPPORTED_FILE_TYPES)
    if (!supportedTypes.includes(file.type)) {
      errors.push(`File "${file.name}" has unsupported type: ${file.type}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Validate multiple files
   *
   * @param {Array<File>} files - Array of file objects
   * @returns {Object} Validation result
   */
  validateFiles(files) {
    const errors = []

    // Check file count
    if (files.length > MAX_FILES) {
      errors.push(`Maximum ${MAX_FILES} files allowed. You selected ${files.length} files.`)
    }

    // Validate each file
    files.forEach(file => {
      const validation = this.validateFile(file)
      if (!validation.isValid) {
        errors.push(...validation.errors)
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Process documents with AI to extract structured data
   *
   * @param {Array<File>} files - Array of file objects
   * @param {Object} context - Additional context for AI processing
   * @returns {Promise<Object>} Extracted data
   */
  async processDocuments(files, context = {}) {
    try {
      // Validate files first
      const validation = this.validateFiles(files)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join('; '),
          data: null
        }
      }

      // Create FormData for file upload
      const formData = new FormData()

      files.forEach((file, index) => {
        formData.append(`documents`, file)
      })

      // Add context as JSON
      formData.append('context', JSON.stringify(context))

      // Upload and process
      const response = await this.apiClient.post(
        '/customer-journey/process-documents',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      return {
        success: true,
        data: response.data.data,
        raw: response.data
      }
    } catch (error) {
      console.error('Error processing documents:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to process documents',
        data: null
      }
    }
  }

  /**
   * Extract text from a single file (simpler version without AI)
   *
   * @param {File} file - File object
   * @returns {Promise<Object>} Extracted text
   */
  async extractText(file) {
    try {
      const validation = this.validateFile(file)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join('; '),
          text: null
        }
      }

      const formData = new FormData()
      formData.append('document', file)

      const response = await this.apiClient.post(
        '/customer-journey/extract-text',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      )

      return {
        success: true,
        text: response.data.text,
        fileName: file.name,
        fileType: file.type
      }
    } catch (error) {
      console.error('Error extracting text:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Failed to extract text',
        text: null
      }
    }
  }

  /**
   * Parse extracted data into structured format
   * This is a client-side helper to normalize AI-extracted data
   *
   * @param {Object} rawData - Raw data from AI
   * @returns {Object} Structured data
   */
  parseExtractedData(rawData) {
    if (!rawData) return null

    return {
      businessDescription: rawData.businessDescription || rawData.description || '',
      keyProcesses: Array.isArray(rawData.keyProcesses)
        ? rawData.keyProcesses
        : (rawData.processes || []),
      painPoints: Array.isArray(rawData.painPoints)
        ? rawData.painPoints
        : (rawData.problems || rawData.challenges || []),
      currentSystems: Array.isArray(rawData.currentSystems)
        ? rawData.currentSystems
        : (rawData.systems || rawData.tools || []),
      employeeBreakdown: Array.isArray(rawData.employeeBreakdown)
        ? rawData.employeeBreakdown
        : [],
      financialData: rawData.financialData || {
        revenue: rawData.revenue || null,
        costs: rawData.costs || null,
        profit: rawData.profit || null
      },
      summary: rawData.summary || '',
      confidence: rawData.confidence || 0.8
    }
  }

  /**
   * Format file size for display
   *
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Get file icon based on file type
   *
   * @param {string} fileType - MIME type
   * @returns {string} PrimeVue icon class
   */
  getFileIcon(fileType) {
    switch (fileType) {
      case SUPPORTED_FILE_TYPES.PDF:
        return 'pi pi-file-pdf'
      case SUPPORTED_FILE_TYPES.DOCX:
      case SUPPORTED_FILE_TYPES.DOC:
        return 'pi pi-file-word'
      case SUPPORTED_FILE_TYPES.XLSX:
      case SUPPORTED_FILE_TYPES.XLS:
        return 'pi pi-file-excel'
      case SUPPORTED_FILE_TYPES.TXT:
        return 'pi pi-file'
      default:
        return 'pi pi-file'
    }
  }
}

// Export singleton instance
export const documentProcessingService = new DocumentProcessingService()

// Export class for testing/customization
export default DocumentProcessingService

// Export constants
export { SUPPORTED_FILE_TYPES, MAX_FILE_SIZE, MAX_FILES }
