/**
 * Document Blocks API Service
 *
 * Frontend wrapper for /api/doc-blocks endpoints.
 * Used by BlockDocumentEditor.vue for block-based document storage (kval database).
 *
 * Офлайн-поддержка: при ошибке сети операции сохраняются локально и
 * синхронизируются автоматически при восстановлении соединения.
 */

import axios from 'axios'
import { getOrchestratorUrl } from '@/utils/apiConfig'
import { offlineSync } from '@/services/offlineSync'

const API_BASE = '/api/doc-blocks'

function getUrl(path = '') {
  const base = getOrchestratorUrl()
  return `${base}${API_BASE}${path}`
}

/** Проверить, является ли ошибка сетевой (нет соединения) */
function isNetworkError(error) {
  return (
    !error.response ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ECONNRESET' ||
    error.code === 'ERR_NETWORK' ||
    error.message === 'Network Error'
  )
}

// Зарегистрировать функцию синхронизации в offlineSync
offlineSync.registerSyncFn(async (op) => {
  if (op.type === 'syncHtml') {
    const { data } = await axios.post(getUrl(`/${op.docId || 'new'}/sync`), {
      html: op.html,
      title: op.title,
      author: op.author,
      folderId: op.folderId,
      userId: op.userId,
      database: op.database,
    })
    return data
  }
})

/**
 * Get all blocks for a document, sorted by order
 * @param {string} docId - Document ID in kval
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{blocks: Array, count: number}>}
 */
export async function getBlocks(docId, database = 'kval') {
  const { data } = await axios.get(getUrl(`/${docId}`), { params: { database } })
  return data
}

/**
 * Get a single block by ID
 * @param {string} blockId
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{block: Object}>}
 */
export async function getBlock(blockId, database = 'kval') {
  const { data } = await axios.get(getUrl(`/block/${blockId}`), { params: { database } })
  return data
}

/**
 * Sync HTML content to blocks (diff-based update)
 * @param {string} docId - Document ID or 'new' for new document
 * @param {string} html - Full HTML content
 * @param {string} title - Document title
 * @param {string} author - Author name
 * @param {string} folderId - Folder ID (optional)
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{documentId: string, blocksCreated: number, blocksUpdated: number, blocksDeleted: number, offline?: boolean}>}
 */
export async function syncHtmlToBlocks(docId, html, title, author, folderId, database = 'kval', userId = null) {
  // Всегда сохраняем локально перед отправкой на сервер
  const safeDocId = docId || 'new'
  await offlineSync.saveLocal(safeDocId, { docId: safeDocId, html, title, folderId, database, userId })

  try {
    const { data } = await axios.post(getUrl(`/${docId || 'new'}/sync`), {
      html,
      title,
      author,
      folderId,
      userId,
      database,
    })
    return data
  } catch (error) {
    if (isNetworkError(error)) {
      // Добавляем в очередь синхронизации
      await offlineSync.enqueue({
        type: 'syncHtml',
        docId,
        html,
        title,
        author,
        folderId,
        database,
        userId,
      })
      // Возвращаем офлайн-ответ, чтобы UI не упал
      return {
        documentId: docId || null,
        blocksCreated: 0,
        blocksUpdated: 0,
        blocksDeleted: 0,
        offline: true,
      }
    }
    throw error
  }
}

/**
 * Create a new document as a copy of a template document
 * @param {string} templateDocId - Source document ID
 * @param {string} newTitle - Title for the new document
 * @param {string} [folderId] - Optional folder ID
 * @param {string} [userId] - Current user ID (sets Пользователь field)
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{documentId: string, blocksCreated: number}>}
 */
export async function copyDocumentFromTemplate(templateDocId, newTitle, folderId, userId, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${templateDocId}/copy-from-template`), {
    newTitle,
    folderId,
    userId,
    database,
  })
  return data
}

/**
 * Assemble blocks back to HTML
 * @param {string} docId - Document ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{html: string, blockCount: number}>}
 */
export async function assembleBlocksToHtml(docId, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${docId}/assemble`), { database })
  return data
}

/**
 * Parse HTML to blocks without saving (dry-run)
 * @param {string} html
 * @returns {Promise<{blocks: Array, count: number}>}
 */
export async function parseHtml(html) {
  const { data } = await axios.post(getUrl('/parse'), { html })
  return data
}

/**
 * Create a new block in a document
 * @param {string} docId - Document ID
 * @param {Object} block - { type, content, order, parentBlockId, metadata }
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{block: Object}>}
 */
export async function createBlock(docId, block, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${docId}/blocks`), { ...block, database })
  return data
}

/**
 * Update a block
 * @param {string} blockId
 * @param {Object} updates - { content, type, order, metadata, author }
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{block: Object}>}
 */
export async function updateBlock(blockId, updates, database = 'kval') {
  const { data } = await axios.put(getUrl(`/block/${blockId}`), { ...updates, database })
  return data
}

/**
 * Delete a block
 * @param {string} blockId
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{deleted: string}>}
 */
export async function deleteBlock(blockId, database = 'kval') {
  const { data } = await axios.delete(getUrl(`/block/${blockId}`), { params: { database } })
  return data
}

/**
 * Reorder blocks — batch update order via _d_ord API
 * @param {string} docId - Document ID
 * @param {Array<{blockId: string, order: number}>} blockOrder - New order
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{updated: number}>}
 */
export async function reorderBlocks(docId, blockOrder, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${docId}/reorder`), { blockOrder, database })
  return data
}

/**
 * Get version history of a block
 * @param {string} blockId
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{versions: Array}>}
 */
export async function getBlockHistory(blockId, database = 'kval') {
  const { data } = await axios.get(getUrl(`/block/${blockId}/history`), { params: { database } })
  return data
}

/**
 * Get user's role in 'my' and target database.
 * @param {string} userId - User object ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{myRole: string, dbRole: string}>}
 */
export async function getUserRole(userId, database = 'kval', docId = null, kvlUserId = null) {
  const params = { userId, database }
  if (docId) params.docId = docId
  if (kvlUserId) params.kvlUserId = kvlUserId
  const { data } = await axios.get(getUrl('/user-role'), { params })
  return data
}

/**
 * Get list of documents from a database, optionally filtered by user role.
 * @param {string} [database='kval'] - Target database
 * @param {Object} [options] - Optional filter: { userId, userDbRole }
 * @returns {Promise<{documents: Array}>}
 */
export async function getDocuments(database = 'kval', options = {}) {
  const params = { database, ...options }
  const { data } = await axios.get(getUrl('/documents'), { params })
  return data
}

/**
 * Get list of folders from kval
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{folders: Array}>}
 */
export async function getFolders(database = 'kval') {
  const { data } = await axios.get(getUrl('/folders'), { params: { database } })
  return data
}

/**
 * Get type metadata from kval (requisites, structure)
 * @param {string|number} typeId
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<Object>}
 */
export async function getTypeMetadata(typeId, database = 'kval') {
  const { data } = await axios.get(getUrl(`/metadata/${typeId}`), { params: { database } })
  return data
}

/**
 * Get objects of a type from kval
 * @param {string|number} typeId
 * @param {Object} params - Query params (LIMIT, F_U, etc.)
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<Object>}
 */
export async function getObjectsByType(typeId, params = {}, database = 'kval') {
  const { data } = await axios.get(getUrl(`/objects/${typeId}`), { params: { ...params, database } })
  return data
}

/**
 * Get dictionary (list of types/tables) from the specified database
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{tables: Object}>}
 */
export async function getTables(database = 'kval') {
  const { data } = await axios.get(getUrl('/tables'), { params: { database } })
  return data
}

/**
 * Get list of reports (type 22 — Query) from the specified database
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{reports: Array}>}
 */
export async function getReports(database = 'kval') {
  const { data } = await axios.get(getUrl('/reports'), { params: { database } })
  return data
}

/**
 * Execute a report from kval by ID
 * @param {string|number} reportId
 * @param {Object} params - Optional filter parameters
 * @returns {Promise<Object>} Report execution result
 */
export async function executeReport(reportId, params = {}) {
  const { data } = await axios.get(getUrl(`/reports/${reportId}/execute`), { params })
  return data
}

/**
 * Get list of all kval users (type 18)
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{users: Array<{id, name}>}>}
 */
export async function getKvalUsers(database = 'kval') {
  const { data } = await axios.get(getUrl('/users'), { params: { database } })
  return data
}

/**
 * Get sharing records, optionally filtered by document
 * @param {string|null} [docId] - Filter by document ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{records: Array}>}
 */
export async function getSharingRecords(docId = null, database = 'kval') {
  const params = { database }
  if (docId) params.docId = docId
  const { data } = await axios.get(getUrl('/sharing'), { params })
  return data
}

/**
 * Create a sharing record
 * @param {string} docId - Document ID
 * @param {string} userId - kval user ID
 * @param {string} accessId - Access level ID (52=BARRED, 53=READ, 54=WRITE)
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{id, docId, userId, accessId}>}
 */
export async function addSharing(docId, userId, accessId, database = 'kval') {
  const { data } = await axios.post(getUrl('/sharing'), { docId, userId, accessId, database })
  return data
}

/**
 * Update sharing record access level
 * @param {string} sharingId - Sharing record ID
 * @param {string} accessId - New access level ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{id, accessId}>}
 */
export async function updateSharing(sharingId, accessId, database = 'kval') {
  const { data } = await axios.put(getUrl(`/sharing/${sharingId}`), { accessId, database })
  return data
}

/**
 * Remove a sharing record
 * @param {string} sharingId - Sharing record ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{deleted: string}>}
 */
export async function removeSharing(sharingId, database = 'kval') {
  const { data } = await axios.delete(getUrl(`/sharing/${sharingId}`), { params: { database } })
  return data
}

/**
 * Assemble scenario document: template + domain blocks + table_embeds
 * @param {string} templateDocId - Template document ID
 * @param {string} scenarioId - Scenario ID
 * @param {string} [settingId] - Setting ID (optional)
 * @returns {Promise<{blocks: Array, html: string, stats: Object}>}
 */
export async function assembleScenarioDocument(templateDocId, scenarioId, settingId = null) {
  const params = { templateDocId, scenarioId }
  if (settingId) params.settingId = settingId
  const { data } = await axios.get(getUrl('/scenario-assemble'), { params })
  return data
}

/**
 * Получить сценарий-ориентированный документ (только доменные блоки)
 * @param {string} scenarioId - Scenario ID
 * @returns {Promise<{scenarioName, scenarioId, domainBlocks[], html, stats}>}
 */
export async function getScenarioView(scenarioId) {
  const { data } = await axios.get(getUrl('/scenario-view'), { params: { scenarioId } })
  return data
}

/**
 * Сохранить отредактированный доменный блок
 * @param {string} blockId - Domain block ID
 * @param {string} content - New content
 * @returns {Promise<{success: boolean}>}
 *
 * Issue #6595: Save domain block with retry logic for network failures
 * WebSocket disconnections may occur, causing 502 errors. This function
 * retries once if the initial request fails.
 */
export async function saveDomainBlock(blockId, content) {
  const url = getUrl(`/domain-block/${blockId}`)
  const payload = { content }

  try {
    const { data } = await axios.post(url, payload)
    return data
  } catch (error) {
    // Issue #6595: Retry on network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' || error.response?.status === 502) {
      console.warn('[docBlocksApiService] Connection error, retrying saveDomainBlock', {
        blockId,
        errorCode: error.code,
        status: error.response?.status
      })

      // Wait 500ms before retry
      await new Promise(resolve => setTimeout(resolve, 500))

      // Retry once
      try {
        const { data } = await axios.post(url, payload)
        console.info('[docBlocksApiService] Retry successful', { blockId })
        return data
      } catch (retryError) {
        console.error('[docBlocksApiService] Retry failed', {
          blockId,
          error: retryError.message
        })
        throw retryError
      }
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Создать новый доменный блок в таблице 467150
 * @param {Object} params - { scenarioId, name, content, layer }
 * @returns {Promise<{id, name, scenarioId, content}>}
 */
export async function createDomainBlock({ scenarioId, name, content = '', layer = '' }) {
  const { data } = await axios.post(getUrl('/domain-blocks'), { scenarioId, name, content, layer })
  return data
}

/**
 * Удалить доменный блок
 * @param {string} blockId - ID доменного блока
 * @returns {Promise<{deleted: string}>}
 */
export async function deleteDomainBlock(blockId) {
  const { data } = await axios.delete(getUrl(`/domain-block/${blockId}`))
  return data
}

/**
 * Переименовать доменный блок
 * @param {string} blockId - ID доменного блока
 * @param {string} name - Новое название
 * @returns {Promise<{blockId, name}>}
 */
export async function renameDomainBlock(blockId, name) {
  const { data } = await axios.put(getUrl(`/domain-block/${blockId}/rename`), { name })
  return data
}

/**
 * Получить секции (такты) шаблонного документа
 * @param {string} docId - ID шаблона
 * @returns {Promise<{sections: Array}>}
 */
export async function getTemplateSections(docId) {
  const { data } = await axios.get(getUrl(`/template-sections/${docId}`), { timeout: 120000 })
  return data
}

/**
 * Get document page settings (cover, editorWidth, etc.) from Integram metadata field
 * @param {string} docId - Document ID
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{metadata: Object}>}
 */
export async function getPageSettings(docId, database = 'kval') {
  const { data } = await axios.get(getUrl(`/${docId}/page-settings`), { params: { database } })
  return data
}

/**
 * Save document page settings (cover, editorWidth, etc.) to Integram metadata field
 * @param {string} docId - Document ID
 * @param {Object} metadata - { editorWidth, cover: { url, x, y } }
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{success: boolean}>}
 */
export async function savePageSettings(docId, metadata, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${docId}/page-settings`), { metadata, database })
  return data
}

/**
 * Move a document to a different folder (or to root if folderId is null/empty)
 * @param {string} docId - Document ID
 * @param {string|null} folderId - Target folder ID, or null for root
 * @param {string} [database='kval'] - Target database
 */
export async function moveDocument(docId, folderId, database = 'kval') {
  const { data } = await axios.put(getUrl(`/${docId}/folder`), { folderId: folderId || null, database })
  return data
}

/**
 * Rename a document (Issue #7106)
 * @param {string} docId - Document ID
 * @param {string} name - New document name
 * @param {string} [database='kval'] - Target database
 */
export async function renameDocument(docId, name, database = 'kval') {
  const { data } = await axios.put(getUrl(`/${docId}/rename`), { name, database })
  return data
}

/**
 * Update document status (Открыт / Закрыт / Опубликован)
 * @param {string} docId - Document ID
 * @param {string} statusId - Status ID (1163=Открыт, 1164=Закрыт, 1263347=Опубликован)
 * @param {string} [database='kval'] - Target database
 */
export async function updateDocumentStatus(docId, statusId, database = 'kval') {
  const { data } = await axios.put(getUrl(`/${docId}/status`), { statusId, database })
  return data
}

/**
 * Bulk update status for multiple documents
 * @param {string[]} docIds - Array of document IDs
 * @param {string} statusId - Status ID to set
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{results: Array}>}
 */
export async function bulkUpdateStatus(docIds, statusId, database = 'kval') {
  const results = await Promise.allSettled(
    docIds.map(docId => updateDocumentStatus(docId, statusId, database))
  )
  return {
    total: docIds.length,
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    results,
  }
}

/**
 * Get available tags from lookup table
 * @param {string} [database='kval'] - Target database
 * @returns {Promise<{tags: Array<{id, name}>}>}
 */
export async function getAvailableTags(database = 'kval') {
  const { data } = await axios.get(getUrl('/tags'), { params: { database } })
  return data
}

/**
 * Add a tag to a document
 * @param {string} docId - Document ID
 * @param {string} tagId - Tag object ID
 * @param {string} [database='kval'] - Target database
 */
export async function addTagToDocument(docId, tagId, database = 'kval') {
  const { data } = await axios.post(getUrl(`/${docId}/tags`), { tagId, database })
  return data
}

/**
 * Remove a tag from a document
 * @param {string} docId - Document ID
 * @param {string} tagId - Tag object ID
 * @param {string} [database='kval'] - Target database
 */
export async function removeTagFromDocument(docId, tagId, database = 'kval') {
  const { data } = await axios.delete(getUrl(`/${docId}/tags/${tagId}`), { params: { database } })
  return data
}

/**
 * Bulk add tag to multiple documents
 * @param {string[]} docIds - Array of document IDs
 * @param {string} tagId - Tag ID to add
 * @param {string} [database='kval'] - Target database
 */
export async function bulkAddTag(docIds, tagId, database = 'kval') {
  const results = await Promise.allSettled(
    docIds.map(docId => addTagToDocument(docId, tagId, database))
  )
  return {
    total: docIds.length,
    success: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }
}

/**
 * Soft-delete a document (change status to "Удален")
 * @param {string} docId - Document ID
 * @param {string} [database='kval'] - Target database
 * @param {Object} [options] - { myUserId, myRole } for author permission check
 * @returns {Promise<{documentId: string, status: string}>}
 */
export async function deleteDocument(docId, database = 'kval', options = {}) {
  const { data } = await axios.delete(getUrl(`/${docId}`), {
    params: { database, myUserId: options.myUserId || undefined, myRole: options.myRole || undefined }
  })
  return data
}

/**
 * Save requisite alias via backend.
 * Issue #6609: When userToken and userXsrf are provided, use user credentials instead of system credentials.
 * @param {string|number} reqId - Requisite ID
 * @param {string} alias - New display name
 * @param {string} [database='kval'] - Target database
 * @param {Object} [userCredentials] - Optional user credentials { token, xsrf } for user-initiated operations
 */
export async function saveDDLAlias(reqId, alias, database = 'kval', userCredentials = null) {
  const payload = { reqId, alias, database }
  // Issue #6609: Pass user credentials if provided
  if (userCredentials?.token && userCredentials?.xsrf) {
    payload.userToken = userCredentials.token
    payload.userXsrf = userCredentials.xsrf
  }
  const { data } = await axios.post(getUrl('/ddl/requisite-alias'), payload)
  return data
}

/**
 * Save requisite attributes via backend.
 * Issue #6609: When userToken and userXsrf are provided, use user credentials instead of system credentials.
 * @param {string|number} reqId - Requisite ID
 * @param {string} attrs - Attributes string (e.g. ':ALIAS=Name:ai-agent:p=prompt:')
 * @param {string} [database='kval'] - Target database
 * @param {Object} [userCredentials] - Optional user credentials { token, xsrf } for user-initiated operations
 */
export async function saveDDLAttrs(reqId, attrs, database = 'kval', userCredentials = null) {
  const payload = { reqId, attrs, database }
  // Issue #6609: Pass user credentials if provided
  if (userCredentials?.token && userCredentials?.xsrf) {
    payload.userToken = userCredentials.token
    payload.userXsrf = userCredentials.xsrf
  }
  const { data } = await axios.post(getUrl('/ddl/requisite-attrs'), payload)
  return data
}

// ============================================================
// Issue #7045: Invite Link API
// ============================================================

/**
 * Create an invite link for a document.
 * @param {string} docId - Document ID
 * @param {string} [database='kval'] - Target database
 * @param {string} [accessId='53'] - Access level: 52=BARRED, 53=READ, 54=WRITE
 * @returns {Promise<{ token: string, inviteUrl: string, expiresAt: string }>}
 */
export async function createInviteLink(docId, database = 'kval', accessId = '53') {
  const { data } = await axios.post(getUrl('/invite-links'), { docId, database, accessId })
  return data
}

/**
 * Validate an invite token and retrieve its metadata.
 * @param {string} token - Invite token
 * @returns {Promise<{ docId: string, database: string, accessId: string, expiresAt: string }>}
 */
export async function getInviteLink(token) {
  const { data } = await axios.get(getUrl(`/invite-links/${token}`))
  return data
}

/**
 * Accept an invite link — creates a sharing record for myUserId.
 * @param {string} token - Invite token
 * @param {string} myUserId - The invitee's 'my' database user ID
 * @returns {Promise<{ sharingId, docId, database, userId, accessId, alreadyExists? }>}
 */
export async function acceptInviteLink(token, myUserId) {
  const { data } = await axios.post(getUrl(`/invite-links/${token}/accept`), { myUserId })
  return data
}

/**
 * Get all databases and documents for a user (owned + shared)
 * @param {string} userId - User ID in 'my' database
 * @param {string} userToken - User's 'my' token
 * @returns {Promise<{success: boolean, databases: Array}>}
 */
export async function getUserWorkspaces(userId, userToken) {
  const { data } = await axios.get(getUrl('/user-workspaces'), {
    params: { userId, userToken },
    headers: { 'X-Authorization': userToken }
  })
  return data
}

/**
 * Create a new Integram database with block editor schema
 * @param {string} dbName - Database name (3-15 lowercase latin + digits, starts with letter)
 * @param {string} userToken - User's 'my' token for X-Authorization
 * @returns {Promise<{success: boolean, dbName: string, schemaCreated: boolean}>}
 */
export async function createDatabase(dbName, userToken) {
  const { data } = await axios.post(getUrl('/create-database'), { dbName }, {
    headers: { 'X-Authorization': userToken }
  })
  return data
}


export default {
  getBlocks,
  getBlock,
  syncHtmlToBlocks,
  assembleBlocksToHtml,
  parseHtml,
  createBlock,
  updateBlock,
  deleteBlock,
  getBlockHistory,
  getDocuments,
  getFolders,
  getTypeMetadata,
  getObjectsByType,
  getTables,
  getReports,
  executeReport,
  assembleScenarioDocument,
  getScenarioView,
  saveDomainBlock,
  createDomainBlock,
  deleteDomainBlock,
  renameDomainBlock,
  getTemplateSections,
  saveDDLAlias,
  saveDDLAttrs,
  getPageSettings,
  savePageSettings,
  copyDocumentFromTemplate,
  moveDocument,
  renameDocument,
  deleteDocument,
  updateDocumentStatus,
  bulkUpdateStatus,
  getAvailableTags,
  addTagToDocument,
  removeTagFromDocument,
  bulkAddTag,
  getKvalUsers,
  getSharingRecords,
  addSharing,
  updateSharing,
  removeSharing,
  createInviteLink,
  getInviteLink,
  acceptInviteLink,
  createDatabase,
  getUserWorkspaces,
}
