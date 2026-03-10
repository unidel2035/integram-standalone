/**
 * Dataset Versioning Service
 *
 * Issue #7191: Dataset Versioning — Git-like commits для строк таблиц
 *
 * Client-side service for interacting with the /api/dataset-versioning endpoints.
 * Wraps commit, history, diff, rollback, and branch operations.
 */

import { getApiUrl } from '@/utils/apiConfig'

/**
 * Build common request params passed to every versioning API call.
 * All are derived from the current Integram session.
 */
function buildConnectionParams(serverUrl, database, token) {
  return { serverUrl, database, token }
}

/**
 * Create a new versioned commit for an Integram object.
 *
 * @param {object} params
 * @param {string} params.serverUrl  - Integram server (e.g. "https://api.ai2o.ru")
 * @param {string} params.database   - Database name (e.g. "kval")
 * @param {string} params.token      - X-Authorization token
 * @param {string} params.xsrfToken  - _xsrf token for POST requests
 * @param {string|number} params.objId - Object ID to version
 * @param {string} [params.message]  - Commit message (like git commit -m)
 * @param {string} [params.branch]   - Branch name (default: "main")
 * @param {string} [params.userId]   - User performing the commit
 * @param {object} [params.updates]  - Field updates { reqId: value } to include in commit
 * @returns {Promise<{ newObjId: string, version: number, parentId: string, branch: string, committedAt: string }>}
 */
export async function commitObject({
  serverUrl,
  database,
  token,
  xsrfToken = '',
  objId,
  message = '',
  branch = 'main',
  userId,
  updates = {},
}) {
  const apiUrl = getApiUrl()
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/commit/${objId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildConnectionParams(serverUrl, database, token),
      xsrfToken,
      message,
      branch,
      userId,
      updates,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `Commit failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * Fetch the version history for an Integram object.
 * Returns the full chain from root (v1) to the given object, oldest first.
 *
 * @param {object} params
 * @param {string} params.serverUrl
 * @param {string} params.database
 * @param {string} params.token
 * @param {string|number} params.objId  - Any object ID in the version chain
 * @returns {Promise<{ history: Array<VersionEntry>, total: number }>}
 */
export async function getHistory({ serverUrl, database, token, objId }) {
  const apiUrl = getApiUrl()
  const qs = new URLSearchParams({ serverUrl, database, token })
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/history/${objId}?${qs}`)

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `History fetch failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * Get the field-by-field diff between two versions.
 *
 * @param {object} params
 * @param {string} params.serverUrl
 * @param {string} params.database
 * @param {string} params.token
 * @param {string|number} params.objId  - Any object in the version chain (for context)
 * @param {string|number} params.v1     - Object ID of first version
 * @param {string|number} params.v2     - Object ID of second version
 * @returns {Promise<{ v1: object, v2: object, changed: Array<DiffEntry>, unchanged: Array<DiffEntry>, summary: object }>}
 */
export async function getDiff({ serverUrl, database, token, objId, v1, v2 }) {
  const apiUrl = getApiUrl()
  const qs = new URLSearchParams({ serverUrl, database, token, v1: String(v1), v2: String(v2) })
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/diff/${objId}?${qs}`)

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `Diff fetch failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * Rollback an object to an older version by creating a new commit.
 *
 * @param {object} params
 * @param {string} params.serverUrl
 * @param {string} params.database
 * @param {string} params.token
 * @param {string} params.xsrfToken
 * @param {string|number} params.objId             - Current (leaf) object ID
 * @param {string|number} params.targetVersionObjId - Object ID of the version to restore
 * @param {string} [params.message]                - Custom rollback message
 * @param {string} [params.branch]                 - Branch for the rollback commit
 * @param {string} [params.userId]
 * @returns {Promise<{ newObjId: string, version: number, restoredFrom: string }>}
 */
export async function rollbackObject({
  serverUrl,
  database,
  token,
  xsrfToken = '',
  objId,
  targetVersionObjId,
  message,
  branch = 'main',
  userId,
}) {
  const apiUrl = getApiUrl()
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/rollback/${objId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildConnectionParams(serverUrl, database, token),
      xsrfToken,
      targetVersionObjId,
      message,
      branch,
      userId,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `Rollback failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * Create a new branch by copying all type objects with a new branch tag.
 *
 * @param {object} params
 * @param {string} params.serverUrl
 * @param {string} params.database
 * @param {string} params.token
 * @param {string} params.xsrfToken
 * @param {string|number} params.typeId   - Integram type/table ID
 * @param {string} params.name            - New branch name
 * @param {string} [params.fromBranch]    - Source branch (default: "main")
 * @param {string} [params.userId]
 * @returns {Promise<{ branch: string, objectsCopied: number }>}
 */
export async function createBranch({
  serverUrl,
  database,
  token,
  xsrfToken = '',
  typeId,
  name,
  fromBranch = 'main',
  userId,
}) {
  const apiUrl = getApiUrl()
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/branch/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildConnectionParams(serverUrl, database, token),
      xsrfToken,
      typeId,
      name,
      fromBranch,
      userId,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `Branch create failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * Merge a source branch into a target branch.
 *
 * @param {object} params
 * @param {string} params.serverUrl
 * @param {string} params.database
 * @param {string} params.token
 * @param {string} params.xsrfToken
 * @param {string|number} params.typeId
 * @param {string} params.sourceBranch
 * @param {string} [params.targetBranch]  - Default: "main"
 * @param {string} [params.strategy]      - Merge strategy: "overwrite" (default)
 * @param {string} [params.userId]
 * @returns {Promise<{ merged: number, conflicts: number }>}
 */
export async function mergeBranch({
  serverUrl,
  database,
  token,
  xsrfToken = '',
  typeId,
  sourceBranch,
  targetBranch = 'main',
  strategy = 'overwrite',
  userId,
}) {
  const apiUrl = getApiUrl()
  const resp = await fetch(`${apiUrl}/api/dataset-versioning/branch/merge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...buildConnectionParams(serverUrl, database, token),
      xsrfToken,
      typeId,
      sourceBranch,
      targetBranch,
      strategy,
      userId,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error ?? `Branch merge failed: HTTP ${resp.status}`)
  }

  return resp.json()
}

/**
 * @typedef {object} VersionEntry
 * @property {string} id
 * @property {number} version
 * @property {string} branch
 * @property {string|null} committedAt
 * @property {string|null} committedBy
 * @property {string|null} commitMsg
 * @property {string|null} parentId
 * @property {boolean} isLatest
 */

/**
 * @typedef {object} DiffEntry
 * @property {string} field   - Requisite alias or reqId
 * @property {string} reqId
 * @property {string|null} from
 * @property {string|null} to
 */
