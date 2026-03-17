/**
 * Auto-backup для деструктивных операций Integram
 *
 * Каждый delete (тип, объект, колонка) автоматически сохраняет
 * snapshot данных в data/backups/integram/ ПЕРЕД удалением.
 *
 * Формат файла: {timestamp}_{operation}_{id}.json
 * Содержимое: { operation, timestamp, meta, data }
 */

import { writeFile, mkdir, readdir, stat } from 'fs/promises'
import { join } from 'path'

const BACKUP_DIR = join(process.cwd(), 'data', 'backups', 'integram')
const MAX_BACKUPS = 1000  // ротация: удаляем старые если > 1000 файлов

/**
 * Сохранить бэкап перед деструктивной операцией
 * @param {string} operation - deleteType | deleteObject | deleteRequisite | deleteTableCascade
 * @param {Object} meta - { id, name?, database? }
 * @param {*} data - данные для сохранения (объекты, структура)
 * @returns {string|null} путь к файлу бэкапа
 */
export async function autoBackup(operation, meta, data) {
  try {
    await mkdir(BACKUP_DIR, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${ts}_${operation}_${meta.id || 'unknown'}.json`
    const filepath = join(BACKUP_DIR, filename)
    await writeFile(filepath, JSON.stringify({
      operation,
      timestamp: new Date().toISOString(),
      ...meta,
      data
    }, null, 2))
    console.log(`[BACKUP] ${operation} ${meta.id} → ${filename}`)

    // Rotate old backups
    try {
      const files = await readdir(BACKUP_DIR)
      if (files.length > MAX_BACKUPS) {
        const sorted = files.sort()
        const toDelete = sorted.slice(0, files.length - MAX_BACKUPS)
        const { unlink } = await import('fs/promises')
        for (const f of toDelete) {
          await unlink(join(BACKUP_DIR, f)).catch(() => {})
        }
        console.log(`[BACKUP] Rotated ${toDelete.length} old backups`)
      }
    } catch (_) {}

    return filepath
  } catch (e) {
    console.error(`[BACKUP FAILED] ${operation} ${meta.id}: ${e.message}`)
    return null
  }
}

/**
 * Список последних бэкапов
 * @param {number} limit - максимум записей
 * @returns {Array<{file, operation, timestamp, id}>}
 */
export async function listBackups(limit = 50) {
  try {
    await mkdir(BACKUP_DIR, { recursive: true })
    const files = (await readdir(BACKUP_DIR)).filter(f => f.endsWith('.json')).sort().reverse()
    return files.slice(0, limit).map(f => {
      // Parse: 2026-03-14T13-25-00-000Z_deleteType_1846555.json
      const parts = f.replace('.json', '').split('_')
      return {
        file: f,
        path: join(BACKUP_DIR, f),
        timestamp: parts[0]?.replace(/-/g, (m, i) => i < 10 ? '-' : i === 10 ? 'T' : ':') || '',
        operation: parts.slice(1, -1).join('_'),
        id: parts[parts.length - 1]
      }
    })
  } catch (e) {
    return []
  }
}

/**
 * Прочитать содержимое бэкапа
 * @param {string} filename — имя файла (или полный путь)
 * @returns {Object|null} — содержимое бэкапа
 */
export async function readBackup(filename) {
  try {
    const { readFile } = await import('fs/promises')
    const filepath = filename.includes('/') ? filename : join(BACKUP_DIR, filename)
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content)
  } catch (e) {
    console.error(`[BACKUP READ] ${filename}: ${e.message}`)
    return null
  }
}

export { BACKUP_DIR }
