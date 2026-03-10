/**
 * Integram Document Editor Schema Service
 *
 * Issue #6480: Universal document editor that works on any Integram database
 *
 * Features:
 * - Auto-creates required tables if they don't exist
 * - Finds tables by name (not hardcoded IDs)
 * - Handles naming conflicts with prefixes
 * - Supports hierarchical folder structure via self-reference
 *
 * Table Structure:
 * 1. Статусы документов (справочник)
 * 2. Папки документов (with self-reference for hierarchy)
 * 3. Документы редактора
 * 4. Файлы документов (file storage with Integram FILE type)
 */

import { logger } from '@/utils/logger'

// Constants
const USERS_TABLE_ID = 18 // Hardcoded - always table 18 for users
const PREFIX = '[integram_doc_editor] '
const BASE_TYPE_ID = 3 // Standard table type

// Requisite types
const REQ_TYPES = {
  SHORT: 3,
  LONG: 2,
  NUMBER: 13,
  DATETIME: 4,
  BOOL: 7,
  FILE: 10
  // REFERENCE uses target table ID
}

// Table names
const TABLE_NAMES = {
  STATUSES: 'Статусы документов',
  FOLDERS: 'Папки документов',
  DOCUMENTS: 'Документы редактора',
  FILES: 'Файлы документов'
}

// Default document statuses
const DEFAULT_STATUSES = [
  'Черновик',
  'На проверке',
  'Опубликован',
  'Архив'
]

/**
 * Document Editor Schema Service
 */
class IntegamDocEditorSchema {
  constructor() {
    this.integramService = null
    this.schema = null // Cached schema { statuses, folders, documents }
    this.initialized = false
  }

  /**
   * Initialize with integram service instance
   * @param {Object} integramService - IntegramService instance
   */
  setService(integramService) {
    this.integramService = integramService
    this.schema = null
    this.initialized = false
  }

  /**
   * Get current Integram datetime format
   * @returns {string} Formatted datetime string
   */
  formatDatetime() {
    const now = new Date()
    const pad = (n) => n.toString().padStart(2, '0')
    return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  /**
   * Normalize table name (strip :ALIAS=...: and similar suffixes)
   * @param {string} name - Table name from dictionary
   * @returns {string} Normalized name
   */
  normalizeTableName(name) {
    if (!name) return ''
    // Remove :ALIAS=...: suffixes that Integram adds
    // Example: "Папки документов:ALIAS=Принадлежность:" -> "Папки документов"
    return name.split(':')[0].trim()
  }

  /**
   * Find table by name in dictionary
   * @param {string} tableName - Table name to find
   * @returns {Promise<{id: number, name: string}|null>} Table info or null
   */
  async findTableByName(tableName) {
    if (!this.integramService) {
      throw new Error('IntegamDocEditorSchema: Service not initialized')
    }

    try {
      const dictionary = await this.integramService.getDictionary()
      const normalizedSearch = this.normalizeTableName(tableName)

      // Dictionary format: { id: "name" } or array
      if (Array.isArray(dictionary)) {
        const found = dictionary.find(t => {
          const name = t.val || t.name
          return this.normalizeTableName(name) === normalizedSearch
        })
        if (found) {
          return { id: parseInt(found.id), name: this.normalizeTableName(found.val || found.name) }
        }
      } else if (typeof dictionary === 'object') {
        for (const [id, name] of Object.entries(dictionary)) {
          if (this.normalizeTableName(name) === normalizedSearch) {
            return { id: parseInt(id), name: this.normalizeTableName(name) }
          }
        }
      }

      // Also try with prefix
      const prefixedName = PREFIX + tableName
      const normalizedPrefixed = this.normalizeTableName(prefixedName)
      if (typeof dictionary === 'object') {
        for (const [id, name] of Object.entries(dictionary)) {
          if (this.normalizeTableName(name) === normalizedPrefixed) {
            return { id: parseInt(id), name: this.normalizeTableName(name) }
          }
        }
      }

      return null
    } catch (error) {
      logger.error('IntegamDocEditorSchema: Error finding table by name', { tableName, error: error.message })
      return null
    }
  }

  /**
   * Check if table name exists in dictionary
   * @param {string} tableName - Table name to check
   * @returns {Promise<boolean>}
   */
  async tableNameExists(tableName) {
    const table = await this.findTableByName(tableName)
    return table !== null
  }

  /**
   * Get unique table name (add prefix if conflict)
   * @param {string} baseName - Base table name
   * @returns {Promise<string>} Unique name
   */
  async getUniqueTableName(baseName) {
    const exists = await this.tableNameExists(baseName)
    if (!exists) {
      return baseName
    }

    // Check if prefixed version exists
    const prefixedName = PREFIX + baseName
    const prefixedExists = await this.tableNameExists(prefixedName)
    if (!prefixedExists) {
      return prefixedName
    }

    // Add timestamp suffix as last resort
    return `${PREFIX}${baseName}_${Date.now()}`
  }

  /**
   * Create statuses lookup table
   * @returns {Promise<{typeId: number, requisites: Object, objects: Array}>}
   */
  async createStatusesTable() {
    logger.info('IntegamDocEditorSchema: Creating statuses table...')

    const tableName = await this.getUniqueTableName(TABLE_NAMES.STATUSES)

    // Create lookup table with default values
    const result = await this.integramService.createLookupTable(tableName, DEFAULT_STATUSES, true)

    logger.info('IntegamDocEditorSchema: Statuses table created', {
      typeId: result.typeId,
      name: tableName,
      statuses: DEFAULT_STATUSES
    })

    return {
      typeId: result.typeId,
      name: tableName,
      requisites: {},
      objects: result.objects
    }
  }

  /**
   * Create folders table with self-reference for hierarchy
   * @returns {Promise<{typeId: number, requisites: Object}>}
   */
  async createFoldersTable() {
    logger.info('IntegamDocEditorSchema: Creating folders table...')

    const tableName = await this.getUniqueTableName(TABLE_NAMES.FOLDERS)

    // Create table first
    const typeResult = await this.integramService.createType(tableName, BASE_TYPE_ID, false)
    const typeId = typeResult.obj || typeResult.id

    if (!typeId) {
      throw new Error(`Failed to create folders table: ${JSON.stringify(typeResult)}`)
    }

    const requisites = {}

    // Add columns in order
    // 1. Принадлежность (REFERENCE to self - for hierarchy)
    const parentReq = await this.integramService.addRequisite(typeId, typeId) // Self-reference!
    if (parentReq.id) {
      await this.integramService.saveAlias(parentReq.id, 'Принадлежность')
      requisites['Принадлежность'] = parentReq.id
    }

    // 2. Порядок сортировки (NUMBER)
    const orderReq = await this.integramService.addRequisite(typeId, REQ_TYPES.NUMBER)
    if (orderReq.id) {
      await this.integramService.saveAlias(orderReq.id, 'Порядок сортировки')
      requisites['Порядок сортировки'] = orderReq.id
    }

    // 3. Автор (REFERENCE to Users table 18)
    const authorReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (authorReq.id) {
      await this.integramService.saveAlias(authorReq.id, 'Автор')
      requisites['Автор'] = authorReq.id
    }

    // 4. Доступ просмотра (MULTISELECT REFERENCE to Users table 18)
    const viewAccessReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (viewAccessReq.id) {
      await this.integramService.saveAlias(viewAccessReq.id, 'Доступ просмотра')
      await this.integramService.toggleMultiselect(viewAccessReq.id)
      requisites['Доступ просмотра'] = viewAccessReq.id
    }

    // 5. Доступ редактирования (MULTISELECT REFERENCE to Users table 18)
    const editAccessReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (editAccessReq.id) {
      await this.integramService.saveAlias(editAccessReq.id, 'Доступ редактирования')
      await this.integramService.toggleMultiselect(editAccessReq.id)
      requisites['Доступ редактирования'] = editAccessReq.id
    }

    // 6. Дата создания (DATETIME)
    const createdReq = await this.integramService.addRequisite(typeId, REQ_TYPES.DATETIME)
    if (createdReq.id) {
      await this.integramService.saveAlias(createdReq.id, 'Дата создания')
      requisites['Дата создания'] = createdReq.id
    }

    // 7. Иконка (SHORT)
    const iconReq = await this.integramService.addRequisite(typeId, REQ_TYPES.SHORT)
    if (iconReq.id) {
      await this.integramService.saveAlias(iconReq.id, 'Иконка')
      requisites['Иконка'] = iconReq.id
    }

    logger.info('IntegamDocEditorSchema: Folders table created', { typeId, name: tableName, requisites })

    return { typeId, name: tableName, requisites }
  }

  /**
   * Create documents table
   * @param {number} foldersTableId - ID of folders table for reference
   * @param {number} statusesTableId - ID of statuses table for reference
   * @returns {Promise<{typeId: number, requisites: Object}>}
   */
  async createDocumentsTable(foldersTableId, statusesTableId) {
    logger.info('IntegamDocEditorSchema: Creating documents table...')

    const tableName = await this.getUniqueTableName(TABLE_NAMES.DOCUMENTS)

    // Create table first
    const typeResult = await this.integramService.createType(tableName, BASE_TYPE_ID, false)
    const typeId = typeResult.obj || typeResult.id

    if (!typeId) {
      throw new Error(`Failed to create documents table: ${JSON.stringify(typeResult)}`)
    }

    const requisites = {}

    // Add columns in order
    // 1. Содержимое (LONG - HTML content)
    const contentReq = await this.integramService.addRequisite(typeId, REQ_TYPES.LONG)
    if (contentReq.id) {
      await this.integramService.saveAlias(contentReq.id, 'Содержимое')
      requisites['Содержимое'] = contentReq.id
    }

    // 2. Принадлежность (REFERENCE to Folders table)
    const folderReq = await this.integramService.addRequisite(typeId, foldersTableId)
    if (folderReq.id) {
      await this.integramService.saveAlias(folderReq.id, 'Принадлежность')
      requisites['Принадлежность'] = folderReq.id
    }

    // 3. Описание (SHORT)
    const descReq = await this.integramService.addRequisite(typeId, REQ_TYPES.SHORT)
    if (descReq.id) {
      await this.integramService.saveAlias(descReq.id, 'Описание')
      requisites['Описание'] = descReq.id
    }

    // 4. Автор (REFERENCE to Users table 18)
    const authorReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (authorReq.id) {
      await this.integramService.saveAlias(authorReq.id, 'Автор')
      requisites['Автор'] = authorReq.id
    }

    // 5. Доступ просмотра (MULTISELECT REFERENCE to Users table 18)
    const viewAccessReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (viewAccessReq.id) {
      await this.integramService.saveAlias(viewAccessReq.id, 'Доступ просмотра')
      await this.integramService.toggleMultiselect(viewAccessReq.id)
      requisites['Доступ просмотра'] = viewAccessReq.id
    }

    // 6. Доступ редактирования (MULTISELECT REFERENCE to Users table 18)
    const editAccessReq = await this.integramService.addRequisite(typeId, USERS_TABLE_ID)
    if (editAccessReq.id) {
      await this.integramService.saveAlias(editAccessReq.id, 'Доступ редактирования')
      await this.integramService.toggleMultiselect(editAccessReq.id)
      requisites['Доступ редактирования'] = editAccessReq.id
    }

    // 7. Иконка (SHORT)
    const iconReq = await this.integramService.addRequisite(typeId, REQ_TYPES.SHORT)
    if (iconReq.id) {
      await this.integramService.saveAlias(iconReq.id, 'Иконка')
      requisites['Иконка'] = iconReq.id
    }

    // 8. Дата создания (DATETIME)
    const createdReq = await this.integramService.addRequisite(typeId, REQ_TYPES.DATETIME)
    if (createdReq.id) {
      await this.integramService.saveAlias(createdReq.id, 'Дата создания')
      requisites['Дата создания'] = createdReq.id
    }

    // 9. Дата редактирования (DATETIME)
    const modifiedReq = await this.integramService.addRequisite(typeId, REQ_TYPES.DATETIME)
    if (modifiedReq.id) {
      await this.integramService.saveAlias(modifiedReq.id, 'Дата редактирования')
      requisites['Дата редактирования'] = modifiedReq.id
    }

    // 10. Статус (REFERENCE to Statuses table)
    const statusReq = await this.integramService.addRequisite(typeId, statusesTableId)
    if (statusReq.id) {
      await this.integramService.saveAlias(statusReq.id, 'Статус')
      requisites['Статус'] = statusReq.id
    }

    // 11. Версия (NUMBER)
    const versionReq = await this.integramService.addRequisite(typeId, REQ_TYPES.NUMBER)
    if (versionReq.id) {
      await this.integramService.saveAlias(versionReq.id, 'Версия')
      requisites['Версия'] = versionReq.id
    }

    logger.info('IntegamDocEditorSchema: Documents table created', { typeId, name: tableName, requisites })

    return { typeId, name: tableName, requisites }
  }

  /**
   * Create files storage table
   * @param {number} documentsTableId - ID of documents table for reference
   * @returns {Promise<{typeId: number, requisites: Object}>}
   */
  async createFilesTable(documentsTableId) {
    logger.info('IntegamDocEditorSchema: Creating files table...')

    const tableName = await this.getUniqueTableName(TABLE_NAMES.FILES)

    // Create table
    const typeResult = await this.integramService.createType(tableName, BASE_TYPE_ID, false)
    const typeId = typeResult.obj || typeResult.id

    if (!typeId) {
      throw new Error(`Failed to create files table: ${JSON.stringify(typeResult)}`)
    }

    const requisites = {}

    // 1. Файл (FILE type - Integram native file storage)
    const fileReq = await this.integramService.addRequisite(typeId, REQ_TYPES.FILE)
    if (fileReq.id) {
      await this.integramService.saveAlias(fileReq.id, 'Файл')
      requisites['Файл'] = fileReq.id
    }

    // 2. Описание (LONG - caption/alt text)
    const descReq = await this.integramService.addRequisite(typeId, REQ_TYPES.LONG)
    if (descReq.id) {
      await this.integramService.saveAlias(descReq.id, 'Описание')
      requisites['Описание'] = descReq.id
    }

    // 3. Документ (REFERENCE to Documents table)
    const docReq = await this.integramService.addRequisite(typeId, documentsTableId)
    if (docReq.id) {
      await this.integramService.saveAlias(docReq.id, 'Документ')
      requisites['Документ'] = docReq.id
    }

    // 4. Тип файла (SHORT - MIME type, e.g. image/png, application/pdf)
    const mimeReq = await this.integramService.addRequisite(typeId, REQ_TYPES.SHORT)
    if (mimeReq.id) {
      await this.integramService.saveAlias(mimeReq.id, 'Тип файла')
      requisites['Тип файла'] = mimeReq.id
    }

    // 5. Размер (NUMBER - file size in bytes)
    const sizeReq = await this.integramService.addRequisite(typeId, REQ_TYPES.NUMBER)
    if (sizeReq.id) {
      await this.integramService.saveAlias(sizeReq.id, 'Размер')
      requisites['Размер'] = sizeReq.id
    }

    // 6. Ширина (NUMBER - image width in pixels)
    const widthReq = await this.integramService.addRequisite(typeId, REQ_TYPES.NUMBER)
    if (widthReq.id) {
      await this.integramService.saveAlias(widthReq.id, 'Ширина')
      requisites['Ширина'] = widthReq.id
    }

    // 7. Высота (NUMBER - image height in pixels)
    const heightReq = await this.integramService.addRequisite(typeId, REQ_TYPES.NUMBER)
    if (heightReq.id) {
      await this.integramService.saveAlias(heightReq.id, 'Высота')
      requisites['Высота'] = heightReq.id
    }

    // 8. Хэш (SHORT - SHA256 hash for deduplication)
    const hashReq = await this.integramService.addRequisite(typeId, REQ_TYPES.SHORT)
    if (hashReq.id) {
      await this.integramService.saveAlias(hashReq.id, 'Хэш')
      requisites['Хэш'] = hashReq.id
    }

    logger.info('IntegamDocEditorSchema: Files table created', { typeId, name: tableName, requisites })

    return { typeId, name: tableName, requisites }
  }

  /**
   * Get requisite map from table metadata
   * @param {number} typeId - Table ID
   * @returns {Promise<Object>} Map of alias -> requisiteId
   */
  async getRequisiteMap(typeId) {
    const metadata = await this.integramService.getMetadata(typeId)
    const requisites = metadata.requisites || metadata.reqs || []

    const reqMap = {}
    requisites.forEach(req => {
      let alias = null
      if (req.attrs && typeof req.attrs === 'string') {
        const match = req.attrs.match(/:ALIAS=([^:]+):/)
        if (match) alias = match[1]
      }
      if (!alias) alias = req.alias || req.requisiteName || req.name || req.val
      const id = req.id || req.requisiteId || req.reqId

      if (alias && id) reqMap[alias] = id.toString()
    })

    return reqMap
  }

  /**
   * Find folder table ID from documents table metadata
   * (detect which folder table documents actually reference)
   * @param {number} documentsTableId - Documents table ID
   * @returns {Promise<number|null>} Folder table ID or null
   */
  async detectFolderTableFromDocuments(documentsTableId) {
    try {
      const metadata = await this.integramService.getMetadata(documentsTableId)
      const reqs = metadata.requisites || metadata.reqs || []

      // Look for folder reference requisite (Принадлежность, Папка, etc.)
      for (const req of reqs) {
        const alias = this.extractAlias(req)
        if (alias && (alias.includes('Принадлежность') || alias.includes('Папка'))) {
          // This is likely the folder reference
          const refTableId = req.arr_id || req.ref || req.orig
          if (refTableId && refTableId !== documentsTableId.toString()) {
            logger.info('IntegamDocEditorSchema: Detected folder table from documents', {
              documentsTableId,
              folderTableId: refTableId,
              alias
            })
            return parseInt(refTableId)
          }
        }
      }
      return null
    } catch (error) {
      logger.warn('IntegamDocEditorSchema: Could not detect folder table', { error: error.message })
      return null
    }
  }

  /**
   * Extract alias from requisite attrs
   * @param {Object} req - Requisite object
   * @returns {string|null} Alias or null
   */
  extractAlias(req) {
    if (req.attrs && typeof req.attrs === 'string') {
      const match = req.attrs.match(/:ALIAS=([^:]+):/)
      if (match) return match[1]
    }
    return req.alias || req.requisiteName || req.name || req.val || null
  }

  /**
   * Initialize schema - find or create all required tables
   * @returns {Promise<Object>} Schema object with table IDs and requisite maps
   */
  async initializeSchema() {
    if (!this.integramService) {
      throw new Error('IntegamDocEditorSchema: Service not initialized')
    }

    logger.info('IntegamDocEditorSchema: Initializing schema...')

    // 1. Find or create Statuses table
    let statuses = await this.findTableByName(TABLE_NAMES.STATUSES)
    if (!statuses) {
      statuses = await this.findTableByName(PREFIX + TABLE_NAMES.STATUSES)
    }
    if (!statuses) {
      const created = await this.createStatusesTable()
      statuses = { id: created.typeId, name: created.name }
    }
    const statusesReqs = await this.getRequisiteMap(statuses.id)

    // 2. Find Documents table first to detect which folder table it uses
    let documents = await this.findTableByName(TABLE_NAMES.DOCUMENTS)
    if (!documents) {
      documents = await this.findTableByName(PREFIX + TABLE_NAMES.DOCUMENTS)
    }

    // 3. Find or create Folders table
    // If documents table exists, try to detect which folder table it references
    let folders = null
    if (documents) {
      const detectedFolderId = await this.detectFolderTableFromDocuments(documents.id)
      if (detectedFolderId) {
        // Use the folder table that documents already reference
        try {
          const folderMeta = await this.integramService.getMetadata(detectedFolderId)
          if (folderMeta && folderMeta.val) {
            folders = {
              id: detectedFolderId,
              name: this.normalizeTableName(folderMeta.val)
            }
            logger.info('IntegamDocEditorSchema: Using detected folder table', folders)
          }
        } catch (e) {
          logger.warn('IntegamDocEditorSchema: Could not get metadata for detected folder table', { detectedFolderId })
        }
      }
    }

    // If no folder table detected, search by name
    if (!folders) {
      folders = await this.findTableByName(TABLE_NAMES.FOLDERS)
    }
    if (!folders) {
      folders = await this.findTableByName(PREFIX + TABLE_NAMES.FOLDERS)
    }
    if (!folders) {
      const created = await this.createFoldersTable()
      folders = { id: created.typeId, name: created.name }
    }
    const foldersReqs = await this.getRequisiteMap(folders.id)

    // 4. Create documents table if it doesn't exist
    if (!documents) {
      const created = await this.createDocumentsTable(folders.id, statuses.id)
      documents = { id: created.typeId, name: created.name }
    }
    const documentsReqs = await this.getRequisiteMap(documents.id)

    // 5. Find or create Files table
    let files = await this.findTableByName(TABLE_NAMES.FILES)
    if (!files) {
      files = await this.findTableByName(PREFIX + TABLE_NAMES.FILES)
    }
    if (!files) {
      const created = await this.createFilesTable(documents.id)
      files = { id: created.typeId, name: created.name }
    }
    const filesReqs = await this.getRequisiteMap(files.id)

    this.schema = {
      statuses: {
        typeId: statuses.id,
        name: statuses.name,
        requisites: statusesReqs
      },
      folders: {
        typeId: folders.id,
        name: folders.name,
        requisites: foldersReqs
      },
      documents: {
        typeId: documents.id,
        name: documents.name,
        requisites: documentsReqs
      },
      files: {
        typeId: files.id,
        name: files.name,
        requisites: filesReqs
      },
      usersTableId: USERS_TABLE_ID
    }

    this.initialized = true

    logger.info('IntegamDocEditorSchema: Schema initialized', this.schema)

    return this.schema
  }

  /**
   * Get current schema (initialize if needed)
   * @returns {Promise<Object>}
   */
  async getSchema() {
    if (!this.initialized || !this.schema) {
      await this.initializeSchema()
    }
    return this.schema
  }

  /**
   * Force reinitialize schema
   * @returns {Promise<Object>}
   */
  async reinitialize() {
    this.schema = null
    this.initialized = false
    return this.initializeSchema()
  }

  /**
   * Create a new folder
   * @param {string} name - Folder name
   * @param {number|null} parentFolderId - Parent folder ID (null for root)
   * @param {Object} options - Additional options { icon, authorId }
   * @returns {Promise<Object>}
   */
  async createFolder(name, parentFolderId = null, options = {}) {
    const schema = await this.getSchema()
    const reqs = schema.folders.requisites

    const requisites = {}

    if (parentFolderId && reqs['Принадлежность']) {
      requisites[reqs['Принадлежность']] = String(parentFolderId)
    }

    if (reqs['Дата создания']) {
      requisites[reqs['Дата создания']] = this.formatDatetime()
    }

    if (options.icon && reqs['Иконка']) {
      requisites[reqs['Иконка']] = options.icon
    }

    if (options.authorId && reqs['Автор']) {
      requisites[reqs['Автор']] = String(options.authorId)
    }

    return this.integramService.createObject(schema.folders.typeId, name, requisites)
  }

  /**
   * Create a new document
   * @param {string} title - Document title
   * @param {string} content - HTML content
   * @param {number} folderId - Folder ID
   * @param {Object} options - Additional options { description, icon, authorId, statusId }
   * @returns {Promise<Object>}
   */
  async createDocument(title, content, folderId, options = {}) {
    const schema = await this.getSchema()
    const reqs = schema.documents.requisites

    const requisites = {}

    if (content && reqs['Содержимое']) {
      requisites[reqs['Содержимое']] = content
    }

    if (folderId && reqs['Принадлежность']) {
      requisites[reqs['Принадлежность']] = String(folderId)
    }

    if (options.description && reqs['Описание']) {
      requisites[reqs['Описание']] = options.description
    }

    if (options.icon && reqs['Иконка']) {
      requisites[reqs['Иконка']] = options.icon
    }

    if (options.authorId && reqs['Автор']) {
      requisites[reqs['Автор']] = String(options.authorId)
    }

    if (reqs['Дата создания']) {
      requisites[reqs['Дата создания']] = this.formatDatetime()
    }

    if (reqs['Дата редактирования']) {
      requisites[reqs['Дата редактирования']] = this.formatDatetime()
    }

    if (options.statusId && reqs['Статус']) {
      requisites[reqs['Статус']] = String(options.statusId)
    }

    if (reqs['Версия']) {
      requisites[reqs['Версия']] = '1'
    }

    return this.integramService.createObject(schema.documents.typeId, title, requisites)
  }

  /**
   * Get all folders as hierarchical tree
   * @returns {Promise<Array>}
   */
  async getFoldersTree() {
    const schema = await this.getSchema()
    const reqs = schema.folders.requisites

    // Get all folders
    const allFolders = await this.integramService.getAllObjects(schema.folders.typeId)

    // Build tree
    const parentReqId = reqs['Принадлежность']
    const foldersMap = new Map()
    const rootFolders = []

    // First pass: create map
    allFolders.forEach(folder => {
      foldersMap.set(folder.id, { ...folder, children: [] })
    })

    // Second pass: build hierarchy
    allFolders.forEach(folder => {
      const node = foldersMap.get(folder.id)
      const parentId = folder.reqs?.[parentReqId]?.value

      if (parentId && foldersMap.has(parseInt(parentId))) {
        foldersMap.get(parseInt(parentId)).children.push(node)
      } else {
        rootFolders.push(node)
      }
    })

    return rootFolders
  }

  /**
   * Get documents in a folder
   * @param {number} folderId - Folder ID
   * @returns {Promise<Array>}
   */
  async getDocumentsInFolder(folderId) {
    const schema = await this.getSchema()
    const reqs = schema.documents.requisites
    const folderReqId = reqs['Принадлежность']

    const allDocs = await this.integramService.getAllObjects(schema.documents.typeId)

    return allDocs.filter(doc => {
      const docFolderId = doc.reqs?.[folderReqId]?.value
      return docFolderId === String(folderId)
    })
  }

  /**
   * Get files linked to a document
   * @param {number} documentId - Document ID
   * @returns {Promise<Array>} Array of file objects with metadata
   */
  async getFilesForDocument(documentId) {
    const schema = await this.getSchema()
    if (!schema.files) return []

    const reqs = schema.files.requisites
    const docReqId = reqs['Документ']
    if (!docReqId) return []

    const allFiles = await this.integramService.getAllObjects(schema.files.typeId)

    return allFiles.filter(file => {
      const fileDocId = file.reqs?.[docReqId]?.value
      return fileDocId === String(documentId)
    })
  }

  /**
   * Build Integram file download URL from a file object
   * @param {Object} fileObj - File object from Integram
   * @param {string} database - Database name (e.g. 'kval')
   * @returns {string|null} Download URL or null
   */
  getFileDownloadUrl(fileObj, database) {
    if (!fileObj || !this.integramService) return null

    const schema = this.schema
    if (!schema?.files) return null

    const fileReqId = schema.files.requisites['Файл']
    if (!fileReqId) return null

    // The file requisite value contains the filename
    // Integram renders FILE type as <a href="download/...">filename</a>
    const fileValue = fileObj.reqs?.[fileReqId]?.value
    if (!fileValue) return null

    // Extract href from HTML anchor if present
    const hrefMatch = fileValue.match(/href="([^"]+)"/)
    if (hrefMatch) {
      const serverUrl = this.integramService.serverURL || 'https://api.ai2o.ru'
      const path = hrefMatch[1].startsWith('/') ? hrefMatch[1] : `/${hrefMatch[1]}`
      return `${serverUrl}${path}`
    }

    return null
  }

  /**
   * Delete folder and all its contents (recursive)
   * @param {number} folderId - Folder ID to delete
   * @returns {Promise<void>}
   */
  async deleteFolderCascade(folderId) {
    const schema = await this.getSchema()
    const foldersReqs = schema.folders.requisites
    const docsReqs = schema.documents.requisites

    // Find child folders
    const allFolders = await this.integramService.getAllObjects(schema.folders.typeId)
    const parentReqId = foldersReqs['Принадлежность']

    const childFolders = allFolders.filter(f =>
      f.reqs?.[parentReqId]?.value === String(folderId)
    )

    // Recursively delete child folders
    for (const child of childFolders) {
      await this.deleteFolderCascade(child.id)
    }

    // Delete documents in this folder
    const folderReqId = docsReqs['Принадлежность']
    const allDocs = await this.integramService.getAllObjects(schema.documents.typeId)
    const docsInFolder = allDocs.filter(d =>
      d.reqs?.[folderReqId]?.value === String(folderId)
    )

    for (const doc of docsInFolder) {
      await this.integramService.deleteObject(doc.id)
    }

    // Delete the folder itself
    await this.integramService.deleteObject(folderId)

    logger.info('IntegamDocEditorSchema: Folder deleted with cascade', { folderId })
  }
}

// Singleton instance
export const docEditorSchema = new IntegamDocEditorSchema()

// Export class for testing
export { IntegamDocEditorSchema }

// Export constants
export { TABLE_NAMES, USERS_TABLE_ID, PREFIX, REQ_TYPES, DEFAULT_STATUSES }
