import apiClient from '@/axios2'

/**
 * Service for managing Intergram database configuration
 * Stores and retrieves service table IDs for different databases
 * Each database has its own service tables (Users, Documents, Workspaces, Menu, etc.)
 * This service helps the interface know which table IDs to use for service operations
 */
class IntergramConfigService {
  constructor() {
    this.CONFIG_KEY = 'intergramDbConfig'
    this.SCHEMA_CACHE_KEY = 'intergramSchemaCache'
    this.CACHE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  }

  /**
   * Get current database configuration
   * @returns {Object|null} Configuration object with table mappings
   */
  getConfig() {
    try {
      const configStr = localStorage.getItem(this.CONFIG_KEY)
      if (!configStr) return null

      const config = JSON.parse(configStr)

      // Check if config has dbName field
      if (!config.dbName) {
        return null
      }

      return config
    } catch (error) {
      console.error('Error reading Intergram config:', error)
      return null
    }
  }

  /**
   * Save database configuration
   * @param {Object} config - Configuration object
   * @param {string} config.dbName - Database name
   * @param {Object} config.tables - Table mappings { tableName: tableId }
   * @param {Date} config.lastUpdated - Last update timestamp
   * @returns {boolean} Success status
   */
  saveConfig(config) {
    try {
      const configToSave = {
        ...config,
        lastUpdated: new Date().toISOString()
      }

      localStorage.setItem(this.CONFIG_KEY, JSON.stringify(configToSave))
      return true
    } catch (error) {
      console.error('Error saving Intergram config:', error)
      return false
    }
  }

  /**
   * Get table ID by service table name
   * @param {string} tableName - Name of the service table (e.g., 'Users', 'Documents', 'Workspaces')
   * @returns {number|null} Table ID or null if not found
   */
  getTableId(tableName) {
    const config = this.getConfig()
    if (!config || !config.tables) return null

    return config.tables[tableName] || null
  }

  /**
   * Set table ID for a service table
   * @param {string} tableName - Name of the service table
   * @param {number} tableId - Table ID
   * @returns {boolean} Success status
   */
  setTableId(tableName, tableId) {
    let config = this.getConfig()

    if (!config) {
      // Get current database name from localStorage
      const dbName = localStorage.getItem('db') || 'A2025'
      config = {
        dbName,
        tables: {}
      }
    }

    config.tables[tableName] = tableId
    return this.saveConfig(config)
  }

  /**
   * Fetch database schema from Intergram API
   * This retrieves all tables in the database
   * @returns {Promise<Array>} Array of table objects
   */
  async fetchDatabaseSchema() {
    try {
      // Check cache first
      const cached = this.getSchemaCache()
      if (cached) {
        return cached
      }

      // Fetch schema from API
      // Intergram typically has an endpoint to list all tables
      // Adjust the endpoint based on actual Intergram API
      const response = await apiClient.get('/tables')

      if (response.data) {
        // Cache the schema
        this.saveSchemaCache(response.data)
        return response.data
      }

      return []
    } catch (error) {
      console.error('Error fetching database schema:', error)
      // Return cached data even if expired, better than nothing
      const cached = this.getSchemaCache(true)
      return cached || []
    }
  }

  /**
   * Get table information by ID
   * @param {number} tableId - Table ID
   * @returns {Promise<Object|null>} Table information or null
   */
  async getTableInfo(tableId) {
    try {
      const response = await apiClient.get(`/tables/${tableId}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching table info for ID ${tableId}:`, error)
      return null
    }
  }

  /**
   * Search for tables by name
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Matching tables
   */
  async searchTables(searchTerm) {
    try {
      const schema = await this.fetchDatabaseSchema()

      if (!searchTerm) return schema

      const term = searchTerm.toLowerCase()
      return schema.filter(table =>
        table.name?.toLowerCase().includes(term) ||
        table.title?.toLowerCase().includes(term)
      )
    } catch (error) {
      console.error('Error searching tables:', error)
      return []
    }
  }

  /**
   * Auto-detect service tables based on common naming patterns
   * @returns {Promise<Object>} Suggested table mappings
   */
  async autoDetectServiceTables() {
    try {
      const schema = await this.fetchDatabaseSchema()
      const suggestions = {}

      // Common patterns for service tables
      const patterns = {
        'Users': /пользовател|user|аккаунт|account/i,
        'Documents': /документ|document/i,
        'Workspaces': /рабочее\s+пространств|workspace|простран/i,
        'Menu': /меню|menu/i,
        'Pages': /страниц|page/i,
        'Access': /доступ|access|permission/i,
        'Roles': /роли|role/i,
        'Settings': /настройк|settings|config/i
      }

      // Try to match tables to patterns
      for (const [serviceName, pattern] of Object.entries(patterns)) {
        const match = schema.find(table =>
          pattern.test(table.name || '') ||
          pattern.test(table.title || '')
        )

        if (match) {
          suggestions[serviceName] = match.id || match.ID
        }
      }

      return suggestions
    } catch (error) {
      console.error('Error auto-detecting service tables:', error)
      return {}
    }
  }

  /**
   * Get schema cache
   * @param {boolean} ignoreExpiry - Ignore expiry check
   * @returns {Array|null} Cached schema or null
   */
  getSchemaCache(ignoreExpiry = false) {
    try {
      const cacheStr = localStorage.getItem(this.SCHEMA_CACHE_KEY)
      if (!cacheStr) return null

      const cache = JSON.parse(cacheStr)

      // Check if cache is expired
      if (!ignoreExpiry) {
        const cacheTime = new Date(cache.timestamp).getTime()
        const now = Date.now()

        if (now - cacheTime > this.CACHE_EXPIRY) {
          return null
        }
      }

      return cache.data
    } catch (error) {
      console.error('Error reading schema cache:', error)
      return null
    }
  }

  /**
   * Save schema cache
   * @param {Array} data - Schema data to cache
   */
  saveSchemaCache(data) {
    try {
      const cache = {
        data,
        timestamp: new Date().toISOString()
      }

      localStorage.setItem(this.SCHEMA_CACHE_KEY, JSON.stringify(cache))
    } catch (error) {
      console.error('Error saving schema cache:', error)
    }
  }

  /**
   * Clear schema cache
   */
  clearSchemaCache() {
    try {
      localStorage.removeItem(this.SCHEMA_CACHE_KEY)
    } catch (error) {
      console.error('Error clearing schema cache:', error)
    }
  }

  /**
   * Clear all configuration
   */
  clearConfig() {
    try {
      localStorage.removeItem(this.CONFIG_KEY)
      this.clearSchemaCache()
      return true
    } catch (error) {
      console.error('Error clearing config:', error)
      return false
    }
  }

  /**
   * Export configuration
   * @returns {Object|null} Configuration object for export
   */
  exportConfig() {
    return this.getConfig()
  }

  /**
   * Import configuration
   * @param {Object} config - Configuration to import
   * @returns {boolean} Success status
   */
  importConfig(config) {
    try {
      if (!config || !config.dbName || !config.tables) {
        throw new Error('Invalid configuration format')
      }

      return this.saveConfig(config)
    } catch (error) {
      console.error('Error importing config:', error)
      return false
    }
  }

  /**
   * Get all configured service table names
   * @returns {Array<string>} Array of table names
   */
  getConfiguredTableNames() {
    const config = this.getConfig()
    if (!config || !config.tables) return []

    return Object.keys(config.tables)
  }

  /**
   * Check if a service table is configured
   * @param {string} tableName - Service table name
   * @returns {boolean} True if configured
   */
  isTableConfigured(tableName) {
    const tableId = this.getTableId(tableName)
    return tableId !== null
  }

  /**
   * Validate current configuration against database
   * @returns {Promise<Object>} Validation results
   */
  async validateConfig() {
    try {
      const config = this.getConfig()
      if (!config || !config.tables) {
        return {
          valid: false,
          errors: ['No configuration found']
        }
      }

      const results = {
        valid: true,
        errors: [],
        warnings: [],
        tableStatus: {}
      }

      // Check each configured table
      for (const [tableName, tableId] of Object.entries(config.tables)) {
        try {
          const tableInfo = await this.getTableInfo(tableId)

          if (tableInfo) {
            results.tableStatus[tableName] = {
              status: 'valid',
              id: tableId,
              info: tableInfo
            }
          } else {
            results.valid = false
            results.errors.push(`Table "${tableName}" (ID: ${tableId}) not found`)
            results.tableStatus[tableName] = {
              status: 'not_found',
              id: tableId
            }
          }
        } catch (error) {
          results.valid = false
          results.errors.push(`Error validating table "${tableName}": ${error.message}`)
          results.tableStatus[tableName] = {
            status: 'error',
            id: tableId,
            error: error.message
          }
        }
      }

      return results
    } catch (error) {
      console.error('Error validating config:', error)
      return {
        valid: false,
        errors: [error.message]
      }
    }
  }
}

export default new IntergramConfigService()
