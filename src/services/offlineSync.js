/**
 * Offline Sync Service
 *
 * Двухуровневое хранилище:
 * 1. IndexedDB — всегда (браузер и Electron)
 * 2. Файловая система через electronAPI — только в Electron
 *
 * Поведение:
 * - При сохранении: сначала локально, потом на сервер
 * - При ошибке сети: добавляет в очередь синхронизации
 * - При восстановлении соединения: автоматически синхронизирует очередь
 */

const DB_NAME = 'dronedoc-offline-v1'
const DB_VERSION = 1
const STORE_DOCS = 'documents'
const STORE_QUEUE = 'sync-queue'

// Является ли приложение десктопным (Electron)
const isElectron = typeof window !== 'undefined' && !!window.electronAPI

class OfflineSync {
  constructor() {
    this._db = null
    this._listeners = {}
    this._syncing = false
    this._syncFn = null // будет установлен из docBlocksApiService
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.pendingCount = 0

    if (typeof window !== 'undefined') {
      this._initDB().then(() => {
        this._loadQueueCount()
        // В Electron: загрузить очередь с диска при старте
        if (isElectron) this._restoreQueueFromDisk()
      })

      window.addEventListener('online', () => this._handleOnline())
      window.addEventListener('offline', () => this._handleOffline())

      // Слушать команду "sync now" из Electron меню
      if (isElectron && window.electronAPI?.onTriggerSync) {
        window.electronAPI.onTriggerSync(() => this.flush())
      }

      // Периодическая синхронизация каждые 30 секунд
      setInterval(() => {
        if (this.isOnline && this.pendingCount > 0) this.flush()
      }, 30_000)
    }
  }

  // ─── IndexedDB ─────────────────────────────────────────────────────────────

  _initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS, { keyPath: 'docId' })
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const store = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true })
          store.createIndex('docId', 'docId', { unique: false })
        }
      }

      req.onsuccess = (e) => {
        this._db = e.target.result
        resolve()
      }

      req.onerror = () => reject(req.error)
    })
  }

  _idbPut(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put(value)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }

  _idbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).get(key)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  }

  _idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readonly')
      const req = tx.objectStore(storeName).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  _idbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).delete(key)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error)
    })
  }

  // ─── Публичный API ─────────────────────────────────────────────────────────

  /**
   * Сохранить документ локально (IndexedDB + файл в Electron)
   * Вызывается ПЕРЕД попыткой синхронизации с сервером
   */
  async saveLocal(docId, payload) {
    if (!this._db) return

    const safeId = docId || 'new'
    const record = {
      ...payload,
      docId: safeId,
      savedAt: Date.now(),
    }

    await this._idbPut(STORE_DOCS, record)

    // В Electron — дублируем на диск
    if (isElectron && docId && docId !== 'new') {
      try {
        await window.electronAPI.writeDoc(docId, record)
      } catch (e) {
        console.warn('[OfflineSync] Не удалось записать на диск:', e.message)
      }
    }
  }

  /**
   * Загрузить документ из локального хранилища
   */
  async loadLocal(docId) {
    if (!this._db) return null

    // Сначала IndexedDB
    const record = await this._idbGet(STORE_DOCS, docId)
    if (record) return record

    // Если нет в IndexedDB — попробовать файл (только Electron)
    if (isElectron) {
      try {
        return await window.electronAPI.readDoc(docId)
      } catch {
        return null
      }
    }

    return null
  }

  /**
   * Добавить операцию в очередь синхронизации
   */
  async enqueue(operation) {
    if (!this._db) return

    await this._idbPut(STORE_QUEUE, {
      ...operation,
      queuedAt: Date.now(),
      attempts: 0,
    })

    this.pendingCount = (await this._idbGetAll(STORE_QUEUE)).length
    this._emit('pending-changed', { count: this.pendingCount })

    // Сохранить очередь на диск в Electron
    if (isElectron) this._persistQueueToDisk()
  }

  /**
   * Убрать операцию из очереди после успешной синхронизации
   */
  async dequeue(id) {
    if (!this._db) return

    await this._idbDelete(STORE_QUEUE, id)
    this.pendingCount = (await this._idbGetAll(STORE_QUEUE)).length
    this._emit('pending-changed', { count: this.pendingCount })

    if (isElectron) this._persistQueueToDisk()
  }

  /**
   * Получить все ожидающие синхронизации операции
   */
  async getPending() {
    if (!this._db) return []
    return this._idbGetAll(STORE_QUEUE)
  }

  /**
   * Зарегистрировать функцию синхронизации (вызывается из docBlocksApiService)
   */
  registerSyncFn(fn) {
    this._syncFn = fn
  }

  /**
   * Принудительно запустить синхронизацию очереди
   */
  async flush() {
    if (this._syncing || !this._syncFn) return
    if (!this._db) return

    const pending = await this.getPending()
    if (pending.length === 0) return

    this._syncing = true
    this._emit('sync-started', { count: pending.length })

    let synced = 0
    let failed = 0

    for (const op of pending) {
      try {
        await this._syncFn(op)
        await this.dequeue(op.id)
        // Удалить файл с диска после успешной синхронизации
        if (isElectron && op.docId && op.docId !== 'new') {
          try {
            await window.electronAPI.deleteDoc(op.docId)
          } catch {}
        }
        synced++
      } catch (e) {
        failed++
        console.warn('[OfflineSync] Не удалось синхронизировать операцию', op.id, e.message)
      }
    }

    this._syncing = false
    this._emit('sync-completed', { synced, failed, remaining: failed })
  }

  /**
   * Список локально сохранённых документов
   */
  async listLocal() {
    if (isElectron) {
      try {
        return await window.electronAPI.listDocs()
      } catch {}
    }
    if (!this._db) return []
    const docs = await this._idbGetAll(STORE_DOCS)
    return docs.map((d) => ({ docId: d.docId, title: d.title, savedAt: d.savedAt }))
  }

  // ─── События ───────────────────────────────────────────────────────────────

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(fn)
    return () => this.off(event, fn)
  }

  off(event, fn) {
    if (!this._listeners[event]) return
    this._listeners[event] = this._listeners[event].filter((f) => f !== fn)
  }

  _emit(event, data) {
    ;(this._listeners[event] || []).forEach((fn) => fn(data))
  }

  // ─── Внутренние методы ─────────────────────────────────────────────────────

  _handleOnline() {
    this.isOnline = true
    this._emit('online')
    // Запустить синхронизацию через секунду (дать время стабилизироваться)
    setTimeout(() => this.flush(), 1000)
  }

  _handleOffline() {
    this.isOnline = false
    this._emit('offline')
  }

  async _loadQueueCount() {
    if (!this._db) return
    const items = await this._idbGetAll(STORE_QUEUE)
    this.pendingCount = items.length
  }

  async _persistQueueToDisk() {
    if (!isElectron || !this._db) return
    try {
      const queue = await this._idbGetAll(STORE_QUEUE)
      await window.electronAPI.saveQueue(queue)
    } catch (e) {
      console.warn('[OfflineSync] Не удалось сохранить очередь на диск:', e.message)
    }
  }

  async _restoreQueueFromDisk() {
    if (!isElectron) return
    try {
      const diskQueue = await window.electronAPI.loadQueue()
      if (!diskQueue?.length || !this._db) return

      // Восстановить очередь из файла в IndexedDB
      for (const op of diskQueue) {
        const existing = op.id ? await this._idbGet(STORE_QUEUE, op.id) : null
        if (!existing) {
          const { id: _id, ...rest } = op
          await this._idbPut(STORE_QUEUE, { ...rest, restoredFromDisk: true })
        }
      }

      await this._loadQueueCount()
    } catch (e) {
      console.warn('[OfflineSync] Не удалось восстановить очередь с диска:', e.message)
    }
  }
}

// Синглтон
export const offlineSync = new OfflineSync()
export default offlineSync
