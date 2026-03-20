/**
 * GiftPersistence — state persistence for the Value Exchange Engine
 *
 * Problem: hours of value exchange data lost on backend restart
 * because state was only in RAM.
 *
 * Solution: SQLite for hot storage + auto-save every 30 sec.
 * On start — instant load from SQLite.
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import logger from '../../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data', 'gift');
const DB_PATH = join(DATA_DIR, 'gift-state.sqlite');

class GiftPersistence {
  constructor() {
    this._db = null;
    this._saveInterval = null;
    this._engine = null;
    this._lastSaveHash = '';
  }

  /**
   * Initialize — create DB and tables
   */
  init(engine) {
    this._engine = engine;

    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    this._db = new Database(DB_PATH);
    this._db.pragma('journal_mode = WAL');
    this._db.pragma('synchronous = NORMAL');

    // Single table — full state snapshot as JSON
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS gift_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state TEXT NOT NULL,
        saved_at TEXT NOT NULL,
        version INTEGER DEFAULT 1
      )
    `);

    // Table for individual stakeholders (for fast access)
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data TEXT NOT NULL
      )
    `);

    // Table for fund milestones
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        milestone_count INTEGER DEFAULT 0,
        last_milestone TEXT,
        saved_at TEXT
      )
    `);

    // Table for reciprocity graph
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS gratitude_edges (
        from_id TEXT NOT NULL,
        to_id TEXT NOT NULL,
        gift_id TEXT NOT NULL,
        created_at TEXT,
        PRIMARY KEY (from_id, to_id, gift_id)
      )
    `);

    logger.info(`[GiftPersistence] SQLite initialized: ${DB_PATH}`);
    return this;
  }

  /**
   * Load state from SQLite
   * Returns object for importState() or null
   */
  load() {
    if (!this._db) return null;

    try {
      const row = this._db.prepare('SELECT state, saved_at FROM gift_state WHERE id = 1').get();
      if (!row) {
        logger.info('[GiftPersistence] No saved state — first launch');
        return null;
      }

      const state = JSON.parse(row.state);
      logger.info(`[GiftPersistence] Loaded state from ${row.saved_at}: ${state.persons?.length || 0} stakeholders, ${state.gifts?.length || 0} exchanges`);
      return state;
    } catch (e) {
      logger.error(`[GiftPersistence] Load error: ${e.message}`);
      return null;
    }
  }

  /**
   * Save current state to SQLite
   */
  save() {
    if (!this._db || !this._engine) return false;

    try {
      const state = this._engine.exportState();
      const json = JSON.stringify(state);

      // Don't save if nothing changed
      const hash = simpleHash(json);
      if (hash === this._lastSaveHash) return false;

      const now = new Date().toISOString();

      const upsert = this._db.prepare(`
        INSERT INTO gift_state (id, state, saved_at, version)
        VALUES (1, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          state = excluded.state,
          saved_at = excluded.saved_at,
          version = version + 1
      `);

      upsert.run(json, now);
      this._lastSaveHash = hash;

      // Save stakeholders separately
      this._savePersons(state.persons);

      logger.info(`[GiftPersistence] Saved: ${state.persons?.length || 0} stakeholders, ${state.gifts?.length || 0} exchanges`);
      return true;
    } catch (e) {
      logger.error(`[GiftPersistence] Save error: ${e.message}`);
      return false;
    }
  }

  _savePersons(persons) {
    if (!persons || !persons.length) return;
    try {
      const upsert = this._db.prepare(`
        INSERT INTO persons (id, name, data)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          data = excluded.data
      `);
      const tx = this._db.transaction((list) => {
        for (const p of list) {
          upsert.run(String(p.id), p.name || '?', JSON.stringify(p));
        }
      });
      tx(persons);
    } catch (e) {
      logger.warn(`[GiftPersistence] Persons save error: ${e.message}`);
    }
  }

  /**
   * Start auto-save every N seconds
   */
  startAutoSave(intervalSec = 30) {
    if (this._saveInterval) clearInterval(this._saveInterval);

    this._saveInterval = setInterval(() => {
      this.save();
    }, intervalSec * 1000);

    logger.info(`[GiftPersistence] Auto-save every ${intervalSec} sec`);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave() {
    if (this._saveInterval) {
      clearInterval(this._saveInterval);
      this._saveInterval = null;
    }
  }

  /**
   * Force save + stop (on server shutdown)
   */
  shutdown() {
    this.stopAutoSave();
    this.save();
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    logger.info('[GiftPersistence] Shutdown — state saved');
  }

  /**
   * Statistics
   */
  getStats() {
    if (!this._db) return { ready: false };
    try {
      const row = this._db.prepare('SELECT saved_at, version FROM gift_state WHERE id = 1').get();
      const personsCount = this._db.prepare('SELECT COUNT(*) as cnt FROM persons').get();
      return {
        ready: true,
        dbPath: DB_PATH,
        lastSaved: row?.saved_at || null,
        version: row?.version || 0,
        personsOnDisk: personsCount?.cnt || 0,
      };
    } catch (e) {
      return { ready: true, error: e.message };
    }
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return String(hash);
}

export { GiftPersistence };
export default GiftPersistence;
