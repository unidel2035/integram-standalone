/**
 * Integram MCP Service
 * Frontend service layer for interacting with Integram MCP server
 *
 * Purpose: Enable Chat.vue and ChatPage.vue to use Integram MCP tools
 * for database operations without loading entire datasets into memory.
 *
 * Architecture:
 * - Frontend (this service) → Backend MCP Bridge → Integram API
 * - Uses HTTP API at https://dev.drondoc.ru/api/mcp/integram
 *
 * Phase 1 Implementation: Foundation (Week 1)
 * - Basic authentication
 * - Connection management
 * - Simple tool execution (get_dictionary)
 */

import axios from 'axios'

// MCP Server Configuration
const MCP_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'https://dev.drondoc.ru'
const MCP_INTEGRAM_ENDPOINT = `${MCP_BASE_URL}/api/mcp/integram`

// Session storage keys
const SESSION_STORAGE_KEYS = {
  AUTH_TOKEN: 'integram_mcp_token',
  XSRF_TOKEN: 'integram_mcp_xsrf',
  SERVER_URL: 'integram_mcp_server_url',
  DATABASE: 'integram_mcp_database',
  USER_ID: 'integram_mcp_user_id',
  USERNAME: 'integram_mcp_username',
  IS_AUTHENTICATED: 'integram_mcp_is_authenticated'
}

/**
 * IntegraMCPService - Main service class
 */
class IntegraMCPService {
  constructor() {
    this.isAuthenticated = false
    this.serverURL = null
    this.database = null
    this.token = null
    this.xsrfToken = null
    this.userId = null
    this.username = null

    // Restore session from storage on initialization
    this.restoreSession()
  }

  /**
   * Restore session from sessionStorage
   */
  restoreSession() {
    try {
      const isAuth = sessionStorage.getItem(SESSION_STORAGE_KEYS.IS_AUTHENTICATED)
      if (isAuth === 'true') {
        this.token = sessionStorage.getItem(SESSION_STORAGE_KEYS.AUTH_TOKEN)
        this.xsrfToken = sessionStorage.getItem(SESSION_STORAGE_KEYS.XSRF_TOKEN)
        this.serverURL = sessionStorage.getItem(SESSION_STORAGE_KEYS.SERVER_URL)
        this.database = sessionStorage.getItem(SESSION_STORAGE_KEYS.DATABASE)
        this.userId = sessionStorage.getItem(SESSION_STORAGE_KEYS.USER_ID)
        this.username = sessionStorage.getItem(SESSION_STORAGE_KEYS.USERNAME)
        this.isAuthenticated = true
      }
    } catch (error) {
      console.warn('Failed to restore MCP session:', error)
      this.clearSession()
    }
  }

  /**
   * Save session to sessionStorage
   */
  saveSession() {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.IS_AUTHENTICATED, 'true')
      sessionStorage.setItem(SESSION_STORAGE_KEYS.AUTH_TOKEN, this.token)
      sessionStorage.setItem(SESSION_STORAGE_KEYS.XSRF_TOKEN, this.xsrfToken)
      sessionStorage.setItem(SESSION_STORAGE_KEYS.SERVER_URL, this.serverURL)
      sessionStorage.setItem(SESSION_STORAGE_KEYS.DATABASE, this.database)
      sessionStorage.setItem(SESSION_STORAGE_KEYS.USER_ID, this.userId)
      sessionStorage.setItem(SESSION_STORAGE_KEYS.USERNAME, this.username)
    } catch (error) {
      console.error('Failed to save MCP session:', error)
    }
  }

  /**
   * Clear session from memory and storage
   */
  clearSession() {
    this.isAuthenticated = false
    this.token = null
    this.xsrfToken = null
    this.serverURL = null
    this.database = null
    this.userId = null
    this.username = null

    Object.values(SESSION_STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key)
    })
  }

  /**
   * Authenticate with Integram API via MCP server
   *
   * @param {Object} credentials - Authentication credentials
   * @param {string} credentials.serverURL - Integram server URL (e.g., 'https://dronedoc.ru')
   * @param {string} credentials.database - Database name (e.g., 'my', 'a2025')
   * @param {string} credentials.login - Username
   * @param {string} credentials.password - Password
   * @returns {Promise<Object>} Authentication result with session tokens
   */
  async authenticate({ serverURL, database, login, password }) {
    try {
      const response = await axios.post(`${MCP_INTEGRAM_ENDPOINT}/execute`, {
        toolName: 'integram_authenticate',
        arguments: {
          serverURL,
          database,
          login,
          password
        }
      })

      if (response.data.success) {
        // Parse the result from MCP response format
        const resultText = response.data.result.content[0].text
        const authData = JSON.parse(resultText)

        if (authData.success) {
          // Store authentication data
          this.serverURL = serverURL
          this.database = database
          this.token = authData.token
          this.xsrfToken = authData.xsrf
          this.userId = authData.userId
          this.username = login
          this.isAuthenticated = true

          // Persist to session storage
          this.saveSession()

          return {
            success: true,
            userId: authData.userId,
            username: login,
            database: database
          }
        } else {
          throw new Error(authData.message || 'Authentication failed')
        }
      } else {
        throw new Error('MCP server returned unsuccessful response')
      }
    } catch (error) {
      this.clearSession()
      console.error('Integram MCP authentication failed:', error)
      throw new Error(`Authentication failed: ${error.message}`)
    }
  }

  /**
   * Set context using existing tokens
   * (Used when restoring session or switching databases)
   *
   * @param {Object} context - Session context
   * @param {string} context.serverURL - Integram server URL
   * @param {string} context.database - Database name
   * @param {string} context.token - Authentication token
   * @param {string} context.xsrfToken - XSRF token
   * @returns {Promise<Object>} Context setting result
   */
  async setContext({ serverURL, database, token, xsrfToken }) {
    try {
      const response = await axios.post(`${MCP_INTEGRAM_ENDPOINT}/execute`, {
        toolName: 'integram_set_context',
        arguments: {
          serverURL,
          database,
          token,
          xsrfToken
        }
      })

      if (response.data.success) {
        this.serverURL = serverURL
        this.database = database
        this.token = token
        this.xsrfToken = xsrfToken
        this.isAuthenticated = true
        this.saveSession()

        return { success: true }
      } else {
        throw new Error('Failed to set context')
      }
    } catch (error) {
      console.error('Integram MCP set context failed:', error)
      throw new Error(`Set context failed: ${error.message}`)
    }
  }

  /**
   * Logout and clear session
   */
  logout() {
    this.clearSession()
    return { success: true }
  }

  /**
   * Get connection status
   *
   * @returns {Object} Connection status information
   */
  getConnectionStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      serverURL: this.serverURL,
      database: this.database,
      username: this.username,
      userId: this.userId
    }
  }

  /**
   * Execute MCP tool
   * Generic method for executing any Integram MCP tool
   *
   * @param {string} toolName - Name of the MCP tool (e.g., 'integram_get_dictionary')
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, args = {}) {
    if (!this.isAuthenticated) {
      throw new Error('Not authenticated. Please authenticate first.')
    }

    try {
      const response = await axios.post(`${MCP_INTEGRAM_ENDPOINT}/execute`, {
        toolName,
        arguments: args
      })

      if (response.data.success) {
        // Parse result from MCP response format
        const resultText = response.data.result.content[0].text
        const result = JSON.parse(resultText)
        return result
      } else {
        throw new Error('Tool execution failed')
      }
    } catch (error) {
      console.error(`MCP tool execution failed (${toolName}):`, error)
      throw new Error(`Tool execution failed: ${error.message}`)
    }
  }

  /**
   * Get list of all available tools
   *
   * @returns {Promise<Array>} Array of tool definitions
   */
  async getAvailableTools() {
    try {
      const response = await axios.get(`${MCP_INTEGRAM_ENDPOINT}/tools`)
      if (response.data.success) {
        return response.data.tools
      } else {
        throw new Error('Failed to fetch tools')
      }
    } catch (error) {
      console.error('Failed to get available MCP tools:', error)
      throw new Error(`Failed to get tools: ${error.message}`)
    }
  }

  // ========== Phase 1: Basic Query Operations ==========

  /**
   * Get dictionary (list of all types/tables)
   *
   * @returns {Promise<Object>} Dictionary with types list
   */
  async getDictionary() {
    return this.executeTool('integram_get_dictionary', {})
  }

  /**
   * Get type metadata (table schema)
   *
   * @param {number} typeId - Type ID
   * @returns {Promise<Object>} Type metadata including requisites (columns)
   */
  async getTypeMetadata(typeId) {
    return this.executeTool('integram_get_type_metadata', { typeId })
  }

  /**
   * Get object list (records from table)
   *
   * @param {number} typeId - Type ID
   * @param {Object} params - Query parameters
   * @param {number} params.offset - Offset for pagination
   * @param {number} params.limit - Limit for pagination
   * @param {string} params.filter - Search filter
   * @returns {Promise<Object>} Object list with pagination info
   */
  async getObjectList(typeId, params = {}) {
    return this.executeTool('integram_get_object_list', {
      typeId,
      params
    })
  }

  /**
   * Get single object details
   *
   * @param {number} objectId - Object ID
   * @returns {Promise<Object>} Object details with requisites
   */
  async getObjectEditData(objectId) {
    return this.executeTool('integram_get_object_edit_data', { objectId })
  }

  /**
   * Execute report
   *
   * @param {number} reportId - Report ID
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Report results
   */
  async executeReport(reportId, params = {}) {
    return this.executeTool('integram_execute_report', {
      reportId,
      params
    })
  }

  // ========== Phase 2+: Data Manipulation Operations ==========
  // These will be implemented in Phase 2 (Basic AI Integration)

  /**
   * Create object (insert record)
   *
   * @param {number} typeId - Type ID
   * @param {string} value - Object value/name
   * @param {Object} requisites - Object requisites (field values)
   * @returns {Promise<Object>} Created object details
   */
  async createObject(typeId, value, requisites = {}) {
    return this.executeTool('integram_create_object', {
      typeId,
      value,
      requisites
    })
  }

  /**
   * Update object
   *
   * @param {number} objectId - Object ID
   * @param {Object} requisites - Updated requisites
   * @returns {Promise<Object>} Update result
   */
  async setObjectRequisites(objectId, requisites) {
    return this.executeTool('integram_set_object_requisites', {
      objectId,
      requisites
    })
  }

  /**
   * Delete object
   *
   * @param {number} objectId - Object ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteObject(objectId) {
    return this.executeTool('integram_delete_object', { objectId })
  }
}

// Create singleton instance
const integraMCPService = new IntegraMCPService()

export default integraMCPService

// Named exports for convenience
export {
  integraMCPService,
  MCP_BASE_URL,
  MCP_INTEGRAM_ENDPOINT,
  SESSION_STORAGE_KEYS
}
