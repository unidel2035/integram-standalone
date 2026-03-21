/**
 * Audit Trail Service
 *
 * Logs all Integram data mutations (_m_set, _m_new, _m_del, _m_save)
 * to a local SQLite database for full change history.
 *
 * Singleton — import and call initialize() once at startup.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '../../data/audit.sqlite')

class AuditService {
  constructor() {
    this.db = null
    this.stmts = {}
  }

  initialize() {
    if (this.db) return

    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    this.db = new Database(DB_PATH)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp  TEXT NOT NULL DEFAULT (datetime('now')),
        database   TEXT NOT NULL,
        action     TEXT NOT NULL,
        object_id  TEXT,
        type_id    TEXT,
        user_id    TEXT,
        user_name  TEXT,
        fields     TEXT DEFAULT '{}',
        source     TEXT DEFAULT 'web',
        metadata   TEXT DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_object ON audit_log(object_id);
      CREATE INDEX IF NOT EXISTS idx_audit_database ON audit_log(database);
      CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(type_id);
    `)

    this.stmts.insert = this.db.prepare(`
      INSERT INTO audit_log (timestamp, database, action, object_id, type_id, user_id, user_name, fields, source, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    this.stmts.insertMany = this.db.transaction((entries) => {
      for (const e of entries) {
        this.stmts.insert.run(
          e.timestamp || new Date().toISOString(),
          e.database || '',
          e.action || 'unknown',
          e.objectId || null,
          e.typeId || null,
          e.userId || null,
          e.userName || null,
          JSON.stringify(e.fields || {}),
          e.source || 'web',
          JSON.stringify(e.metadata || {})
        )
      }
    })

    this.stmts.query = this.db.prepare(`
      SELECT * FROM audit_log
      WHERE (?1 IS NULL OR database = ?1)
        AND (?2 IS NULL OR object_id = ?2)
        AND (?3 IS NULL OR type_id = ?3)
        AND (?4 IS NULL OR user_id = ?4)
        AND (?5 IS NULL OR action = ?5)
        AND (?6 IS NULL OR timestamp >= ?6)
        AND (?7 IS NULL OR timestamp <= ?7)
      ORDER BY id DESC
      LIMIT ?8
    `)

    console.log('[AuditService] Initialized, DB:', DB_PATH)
  }

  /**
   * Log one or more audit entries
   * @param {Array|Object} entries
   */
  log(entries) {
    if (!this.db) return
    const arr = Array.isArray(entries) ? entries : [entries]
    if (arr.length === 0) return
    try {
      this.stmts.insertMany(arr)
    } catch (err) {
      console.error('[AuditService] Log error:', err.message)
    }
  }

  /**
   * Query audit log
   * @param {Object} filters - { database, objectId, typeId, userId, action, from, to, limit }
   * @returns {Array}
   */
  query(filters = {}) {
    if (!this.db) return []
    try {
      return this.stmts.query.all(
        filters.database || null,
        filters.objectId || null,
        filters.typeId || null,
        filters.userId || null,
        filters.action || null,
        filters.from || null,
        filters.to || null,
        filters.limit || 100
      )
    } catch (err) {
      console.error('[AuditService] Query error:', err.message)
      return []
    }
  }

  /**
   * Get change history for a specific object
   */
  getObjectHistory(objectId, limit = 50) {
    return this.query({ objectId, limit })
  }

  /**
   * Get recent changes across all objects
   */
  getRecent(limit = 50) {
    return this.query({ limit })
  }
}

// Singleton
const auditService = new AuditService()
export default auditService
