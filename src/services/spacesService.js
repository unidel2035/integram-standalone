/**
 * Spaces Service
 * Issue #3926: Dynamic spaces data loading from Integram database
 *
 * Fetches spaces (agents) data from report "spaces" at:
 * https://ai2o.ru/my/report/spaces
 *
 * Universal service that works with any Integram database
 */

import integramService from './integramApiClient'
import { logger } from '@/utils/logger'

class SpacesService {
  constructor() {
    // Report name to search for (universal across databases)
    this.reportName = 'spaces'
    // Column name mappings from report to space object
    this.columnMappings = {
      name: ['Агент', 'агент', 'name', 'название'],
      description: ['Описание', 'описание', 'description'],
      icon: ['Иконка', 'иконка', 'icon', 'emoji'],
      category: ['Категория агента', 'категория', 'category'],
      path: ['path', 'путь', 'route', 'url'],
      creator: ['creator', 'создатель', 'author'],
      status: ['Статус', 'статус', 'status'],
      tags: ['тег', 'теги', 'tags'],
      active: ['Активный', 'активный', 'active']
    }
    // Cache
    this.cachedSpaces = null
    this.cachedReportId = null
    this.cacheTimestamp = null
    this.cacheDuration = 5 * 60 * 1000 // 5 minutes cache
  }

  /**
   * Get spaces data from database report
   * @param {Object} options - Options for fetching
   * @param {boolean} options.forceRefresh - Force refresh from database
   * @param {string} options.database - Database name (default: 'my')
   * @returns {Promise<Array>} Array of space objects
   */
  async getSpaces(options = {}) {
    const { forceRefresh = false, database = 'my' } = options

    try {
      // Check cache
      if (!forceRefresh && this.cachedSpaces && this.cacheTimestamp) {
        const cacheAge = Date.now() - this.cacheTimestamp
        if (cacheAge < this.cacheDuration) {
          logger.info('[spacesService] Returning cached spaces data')
          return this.cachedSpaces
        }
      }

      logger.info('[spacesService] Fetching spaces from database:', database)

      // Ensure we're using the correct database
      if (integramService.getDatabase() !== database) {
        integramService.setDatabase(database)
      }

      // Check if authenticated
      if (!integramService.isAuthenticated()) {
        throw new Error('Not authenticated. Please log in first.')
      }

      // Execute the spaces report directly by name
      // Issue #3926: Use report name "spaces" directly instead of searching for ID
      // This works because Integram API accepts both report ID and report name
      // URL: https://ai2o.ru/my/report/spaces
      logger.info('[spacesService] Executing report by name:', this.reportName)
      const reportData = await integramService.executeReport(this.reportName, {})

      logger.info(`[spacesService] Report returned ${Array.isArray(reportData) ? reportData.length : 0} rows`)

      // Transform report data to spaces format (group by unique path)
      const spaces = this.transformReportToSpaces(reportData)

      // Cache the result
      this.cachedSpaces = spaces
      this.cacheTimestamp = Date.now()

      logger.info('[spacesService] Transformed to', spaces.length, 'unique spaces')

      return spaces
    } catch (error) {
      logger.error('[spacesService] Error fetching spaces:', error)
      throw error
    }
  }

  /**
   * Find "spaces" report in the database by name
   * @returns {Promise<number|null>} Report ID or null if not found
   * @deprecated Use executeReport with report name directly instead
   */
  async findSpacesReport() {
    try {
      logger.info('[spacesService] Looking for spaces report...')

      // Get list of reports (type 22 = Query)
      // Use high limit because "spaces" report may be far in the list (e.g., ID 197995)
      const REPORT_TYPE_ID = 22
      const reportsData = await integramService.getObjects(REPORT_TYPE_ID, { limit: 500 })

      const reports = reportsData.object || []
      logger.info(`[spacesService] Found ${reports.length} reports`)

      // Find report with name "spaces"
      const spacesReport = reports.find(r =>
        r.val?.toLowerCase() === this.reportName ||
        r.val?.toLowerCase().includes(this.reportName)
      )

      if (spacesReport) {
        this.cachedReportId = parseInt(spacesReport.id)
        logger.info(`[spacesService] Found spaces report: "${spacesReport.val}" (ID: ${spacesReport.id})`)
        return this.cachedReportId
      }

      logger.warn('[spacesService] No spaces report found')
      return null
    } catch (error) {
      logger.error('[spacesService] Error finding spaces report:', error)
      throw error
    }
  }

  /**
   * Transform report data to spaces array format
   * Groups rows by path to avoid duplicates (report may have multiple rows per agent due to tags)
   * @param {Array} reportData - Array of report rows
   * @returns {Array} Array of unique space objects
   */
  transformReportToSpaces(reportData) {
    if (!Array.isArray(reportData) || reportData.length === 0) {
      return []
    }

    // Group by path to consolidate tags
    const spacesByPath = new Map()

    reportData.forEach((row, index) => {
      try {
        const path = this.getValue(row, 'path') || `/space-${index}`

        if (spacesByPath.has(path)) {
          // Add tag to existing space
          const existingSpace = spacesByPath.get(path)
          const newTag = this.getValue(row, 'tags')
          if (newTag && !existingSpace.tags.includes(newTag)) {
            existingSpace.tags.push(newTag)
          }
        } else {
          // Create new space entry
          const space = {
            id: path.replace(/^\//, '').replace(/\//g, '-') || `space-${index}`,
            name: this.getValue(row, 'name') || `Space ${index + 1}`,
            description: this.getValue(row, 'description') || '',
            icon: this.getValue(row, 'icon') || '🚀',
            category: this.getValue(row, 'category') || 'other',
            path: path,
            creator: this.getValue(row, 'creator') || 'DronDoc Team',
            status: this.getValue(row, 'status') || 'Running',
            tags: [],
            active: this.getValue(row, 'active') || ''
          }

          // Add initial tag
          const tag = this.getValue(row, 'tags')
          if (tag) {
            space.tags.push(tag)
          }

          spacesByPath.set(path, space)
        }
      } catch (error) {
        logger.error(`[spacesService] Error transforming row ${index}:`, error)
      }
    })

    return Array.from(spacesByPath.values())
  }

  /**
   * Get value from row by field name using column mappings
   * @param {Object} row - Report row object
   * @param {string} fieldName - Field name to get
   * @returns {string} Field value or empty string
   */
  getValue(row, fieldName) {
    const possibleNames = this.columnMappings[fieldName] || [fieldName]

    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        let value = String(row[name]).trim()

        // Special handling for icon field - extract text from HTML if needed
        if (fieldName === 'icon' && value.includes('<')) {
          // Extract text content from HTML (e.g., "<a href='...'>pi pi-fw pi-code</a>" -> "pi pi-fw pi-code")
          const textMatch = value.match(/>([^<]+)</);
          if (textMatch) {
            value = textMatch[1].trim()
          }
        }

        return value
      }
    }

    return ''
  }

  /**
   * Parse tags from string or array
   * @param {string|Array} tagsValue - Tags value from database
   * @returns {Array} Array of tag strings
   */
  parseTags(tagsValue) {
    if (!tagsValue) return []

    if (Array.isArray(tagsValue)) {
      return tagsValue
    }

    if (typeof tagsValue === 'string') {
      // Try to parse as JSON array
      try {
        const parsed = JSON.parse(tagsValue)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch (e) {
        // Not JSON, try comma-separated
      }

      // Parse comma or semicolon separated tags
      return tagsValue
        .split(/[,;]+/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
    }

    return []
  }

  /**
   * Extract additional fields from row
   * @param {Array} row - Data row
   * @param {Object} columnMap - Column name to index map
   * @returns {Object} Additional fields
   */
  extractAdditionalFields(row, columnMap) {
    const additional = {}

    // Common additional fields
    const additionalFieldNames = [
      'created_at', 'updated_at', 'created', 'updated',
      'priority', 'приоритет',
      'enabled', 'активен', 'active',
      'version', 'версия',
      'type', 'тип'
    ]

    additionalFieldNames.forEach(fieldName => {
      const colIndex = columnMap[fieldName.toLowerCase()]
      if (colIndex !== undefined && row[colIndex] !== null && row[colIndex] !== undefined) {
        additional[fieldName] = row[colIndex]
      }
    })

    return additional
  }

  /**
   * Create new space in database
   * @param {Object} spaceData - Space data to create
   * @returns {Promise<Object>} Created space object
   */
  async createSpace(spaceData) {
    try {
      logger.info('[spacesService] Creating new space:', spaceData.name)

      // Find spaces type ID (assuming there's a "Spaces" or "Агенты" type)
      const dict = await integramService.getDictionary()
      const spacesType = dict.types?.find(t =>
        t.name?.toLowerCase().includes('space') ||
        t.name?.toLowerCase().includes('агент') ||
        t.name?.toLowerCase().includes('agent')
      )

      if (!spacesType) {
        throw new Error('Spaces type not found in database')
      }

      logger.info(`[spacesService] Using type "${spacesType.name}" (ID: ${spacesType.id})`)

      // Get type metadata to understand requisites
      const metadata = await integramService.getMetadata(spacesType.id)

      // Map space data to requisites
      const requisites = this.mapSpaceDataToRequisites(spaceData, metadata)

      // Create object
      const result = await integramService.createObject(
        spacesType.id,
        spaceData.name,
        requisites
      )

      // Clear cache to force refresh
      this.clearCache()

      logger.info('[spacesService] Space created successfully:', result)

      return result
    } catch (error) {
      logger.error('[spacesService] Error creating space:', error)
      throw error
    }
  }

  /**
   * Map space data to requisites based on type metadata
   * @param {Object} spaceData - Space data
   * @param {Object} metadata - Type metadata
   * @returns {Object} Requisites object
   */
  mapSpaceDataToRequisites(spaceData, metadata) {
    const requisites = {}

    if (!metadata.requisites) {
      return requisites
    }

    // Map standard fields to requisites
    const fieldMappings = {
      description: ['description', 'описание', 'desc'],
      icon: ['icon', 'иконка', 'emoji'],
      category: ['category', 'категория'],
      path: ['path', 'путь', 'route', 'url'],
      creator: ['creator', 'создатель', 'author'],
      status: ['status', 'статус', 'state'],
      tags: ['tags', 'теги', 'метки']
    }

    metadata.requisites.forEach(req => {
      const reqName = (req.alias || '').toLowerCase()

      // Find matching field
      for (const [field, possibleNames] of Object.entries(fieldMappings)) {
        if (possibleNames.some(name => reqName.includes(name))) {
          let value = spaceData[field]

          // Handle tags as comma-separated string
          if (field === 'tags' && Array.isArray(value)) {
            value = value.join(', ')
          }

          if (value) {
            requisites[req.id] = value
          }

          break
        }
      }
    })

    return requisites
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cachedSpaces = null
    this.cachedReportId = null
    this.cacheTimestamp = null
    logger.info('[spacesService] Cache cleared')
  }

  /**
   * Get spaces report metadata
   * @returns {Promise<Object>} Report metadata
   */
  async getSpacesReportMetadata() {
    try {
      if (!this.cachedReportId) {
        await this.findSpacesReport()
      }

      if (!this.cachedReportId) {
        throw new Error('Spaces report not found')
      }

      const metadata = await integramService.getEditObject(this.cachedReportId)
      return metadata
    } catch (error) {
      logger.error('[spacesService] Error getting report metadata:', error)
      throw error
    }
  }
}

// Export singleton instance
const spacesService = new SpacesService()
export default spacesService
