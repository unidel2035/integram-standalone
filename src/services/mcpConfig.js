/**
 * MCP (Model Context Protocol) Configuration
 * Configuration for Integram MCP server
 */

import { getIntegramApiBaseUrl } from '@/utils/integramConfig'

export const MCP_CONFIG = {
  // Base URL for Integram API - use config instead of hardcoded dronedoc.ru
  BASE_URL: import.meta.env.VITE_INTEGRAM_BASE_URL || getIntegramApiBaseUrl(),

  // Default database
  DEFAULT_DATABASE: import.meta.env.VITE_INTEGRAM_DATABASE || 'my',

  // API endpoints
  ENDPOINTS: {
    AUTHENTICATE: '/api/auth/session',
    DICTIONARY: '/api/:database/dictionary',
    TYPE_METADATA: '/api/:database/type/:typeId',
    OBJECT_LIST: '/api/:database/type/:typeId/objects',
    OBJECT_EDIT: '/api/:database/object/:objectId/edit',
    CREATE_OBJECT: '/api/:database/type/:typeId/create',
    SAVE_OBJECT: '/api/:database/object/:objectId/save',
    REPORT: '/api/:database/report/:reportId'
  }
}
