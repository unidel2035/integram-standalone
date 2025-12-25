/**
 * FileWatcherService - Watches files in workspaces for changes
 *
 * Tracks file modifications, additions, and deletions within workspace directories.
 * Emits events when changes are detected.
 */

import chokidar from 'chokidar'
import path from 'path'
import fs from 'fs/promises'
import { EventEmitter } from 'events'

class FileWatcherService extends EventEmitter {
  constructor() {
    super()
    // Map of workspaceId -> watcher instance
    this.watchers = new Map()
    // Map of workspaceId -> file changes history
    this.changeHistory = new Map()
    // Max history per workspace
    this.maxHistorySize = 100
  }

  /**
   * Start watching a workspace directory
   * @param {string} workspaceId - Unique workspace ID
   * @param {string} workspacePath - Path to workspace directory
   * @param {object} options - Watch options
   */
  async startWatching(workspaceId, workspacePath, options = {}) {
    // Stop existing watcher if any
    if (this.watchers.has(workspaceId)) {
      await this.stopWatching(workspaceId)
    }

    // Verify path exists
    try {
      await fs.access(workspacePath)
    } catch (error) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`)
    }

    const watchOptions = {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      depth: options.depth || 10,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      },
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.log',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/.DS_Store',
        ...(options.ignored || [])
      ]
    }

    const watcher = chokidar.watch(workspacePath, watchOptions)

    // Initialize change history
    this.changeHistory.set(workspaceId, [])

    // Set up event handlers
    watcher
      .on('add', (filePath) => this.handleFileEvent(workspaceId, 'add', filePath, workspacePath))
      .on('change', (filePath) => this.handleFileEvent(workspaceId, 'change', filePath, workspacePath))
      .on('unlink', (filePath) => this.handleFileEvent(workspaceId, 'unlink', filePath, workspacePath))
      .on('addDir', (dirPath) => this.handleFileEvent(workspaceId, 'addDir', dirPath, workspacePath))
      .on('unlinkDir', (dirPath) => this.handleFileEvent(workspaceId, 'unlinkDir', dirPath, workspacePath))
      .on('error', (error) => {
        console.error(`[FileWatcher] Error in workspace ${workspaceId}:`, error)
        this.emit('error', { workspaceId, error: error.message })
      })
      .on('ready', () => {
        console.log(`[FileWatcher] Started watching workspace ${workspaceId}: ${workspacePath}`)
        this.emit('ready', { workspaceId, path: workspacePath })
      })

    this.watchers.set(workspaceId, {
      watcher,
      path: workspacePath,
      startedAt: new Date().toISOString(),
      options
    })

    return {
      workspaceId,
      path: workspacePath,
      status: 'watching'
    }
  }

  /**
   * Handle file system events
   */
  handleFileEvent(workspaceId, eventType, filePath, basePath) {
    const relativePath = path.relative(basePath, filePath)
    const timestamp = new Date().toISOString()

    const changeEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      type: eventType,
      path: relativePath,
      fullPath: filePath,
      timestamp,
      extension: path.extname(filePath),
      filename: path.basename(filePath)
    }

    // Add to history
    const history = this.changeHistory.get(workspaceId) || []
    history.unshift(changeEvent)

    // Trim history if too long
    if (history.length > this.maxHistorySize) {
      history.pop()
    }

    this.changeHistory.set(workspaceId, history)

    // Emit event
    this.emit('change', changeEvent)

    console.log(`[FileWatcher] ${eventType}: ${relativePath} in workspace ${workspaceId}`)

    return changeEvent
  }

  /**
   * Stop watching a workspace
   */
  async stopWatching(workspaceId) {
    const watcherData = this.watchers.get(workspaceId)
    if (!watcherData) {
      return { success: false, message: 'Watcher not found' }
    }

    await watcherData.watcher.close()
    this.watchers.delete(workspaceId)
    // Clean up change history to prevent memory leak
    this.changeHistory.delete(workspaceId)

    console.log(`[FileWatcher] Stopped watching workspace ${workspaceId}`)

    return { success: true, workspaceId }
  }

  /**
   * Get change history for a workspace
   */
  getHistory(workspaceId, limit = 50) {
    const history = this.changeHistory.get(workspaceId) || []
    return history.slice(0, limit)
  }

  /**
   * Clear change history for a workspace
   */
  clearHistory(workspaceId) {
    this.changeHistory.set(workspaceId, [])
    return { success: true }
  }

  /**
   * Get status of all watchers
   */
  getStatus() {
    const status = []
    for (const [workspaceId, data] of this.watchers) {
      status.push({
        workspaceId,
        path: data.path,
        startedAt: data.startedAt,
        changesCount: (this.changeHistory.get(workspaceId) || []).length
      })
    }
    return status
  }

  /**
   * Check if workspace is being watched
   */
  isWatching(workspaceId) {
    return this.watchers.has(workspaceId)
  }

  /**
   * Stop all watchers
   */
  async stopAll() {
    const promises = []
    for (const workspaceId of this.watchers.keys()) {
      promises.push(this.stopWatching(workspaceId))
    }
    await Promise.all(promises)
    // Clear all remaining history
    this.changeHistory.clear()
    console.log('[FileWatcher] All watchers stopped')
  }
}

// Singleton instance
export const fileWatcherService = new FileWatcherService()

export { FileWatcherService }
