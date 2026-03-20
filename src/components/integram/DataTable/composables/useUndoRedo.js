/**
 * Undo/Redo Composable for DataTable
 * Issue #6784: Implements undo/redo functionality for DataTable operations
 *
 * Supports:
 * - Cell editing (editCell)
 * - Row deletion (deleteRow)
 * - Paste operations (pasteRange)
 * - Clear cell (clearCell)
 *
 * Usage:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Y / Cmd+Y: Redo
 * - Ctrl+Shift+Z / Cmd+Shift+Z: Redo (alternative)
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'

const MAX_HISTORY_SIZE = 50

export function useUndoRedo(emit, props) {
  // History stack for tracking actions
  const historyStack = ref([]) // Array of command objects
  const historyIndex = ref(-1) // Current position in history (-1 = no history)

  /**
   * Command interface:
   * {
   *   type: 'cell-edit' | 'row-delete' | 'paste-range' | 'clear-cell',
   *   data: { ... operation-specific data ... },
   *   execute: () => void,  // Re-execute the command (for redo)
   *   undo: () => void      // Undo the command
   * }
   */

  /**
   * Add command to history stack
   * Removes any commands after current index (when user undoes then does new action)
   */
  const addToHistory = command => {
    // Skip if editing is disabled
    if (props?.disableEditing) return

    // Remove any commands after current index
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)

    // Add new command
    historyStack.value.push(command)

    // Limit stack size (FIFO: remove oldest if exceeds limit)
    if (historyStack.value.length > MAX_HISTORY_SIZE) {
      historyStack.value.shift()
    } else {
      historyIndex.value++
    }

    console.log('[UndoRedo] Added command:', command.type, 'Stack size:', historyStack.value.length, 'Index:', historyIndex.value)
  }

  /**
   * Undo last action (Ctrl+Z)
   */
  const undo = () => {
    if (props?.disableEditing) {
      console.log('[UndoRedo] Undo blocked: editing disabled')
      return
    }

    if (historyIndex.value < 0) {
      console.log('[UndoRedo] Nothing to undo')
      return
    }

    const command = historyStack.value[historyIndex.value]
    console.log('[UndoRedo] Undoing:', command.type, 'Data:', command.data)

    // Execute undo
    try {
      command.undo()
      historyIndex.value--
      console.log('[UndoRedo] Undo successful. New index:', historyIndex.value)
    } catch (error) {
      console.error('[UndoRedo] Undo failed:', error)
    }
  }

  /**
   * Redo action (Ctrl+Y or Ctrl+Shift+Z)
   */
  const redo = () => {
    if (props?.disableEditing) {
      console.log('[UndoRedo] Redo blocked: editing disabled')
      return
    }

    if (historyIndex.value >= historyStack.value.length - 1) {
      console.log('[UndoRedo] Nothing to redo')
      return
    }

    historyIndex.value++
    const command = historyStack.value[historyIndex.value]
    console.log('[UndoRedo] Redoing:', command.type, 'Data:', command.data)

    // Execute redo (re-execute the command)
    try {
      command.execute()
      console.log('[UndoRedo] Redo successful. New index:', historyIndex.value)
    } catch (error) {
      console.error('[UndoRedo] Redo failed:', error)
      historyIndex.value-- // Rollback on error
    }
  }

  /**
   * Create command for cell edit
   * @param {string} headerId - Column ID
   * @param {number} rowId - Row ID
   * @param {*} oldValue - Previous cell value
   * @param {*} newValue - New cell value
   * @param {object} header - Column header metadata
   */
  const createCellEditCommand = (headerId, rowId, oldValue, newValue, header) => {
    return {
      type: 'cell-edit',
      data: { headerId, rowId, oldValue, newValue, headerType: header?.type },
      execute: () => {
        // Apply new value (re-execute edit)
        emit('cell-update', { headerId, rowId, value: newValue, type: header?.type })
      },
      undo: () => {
        // Restore old value
        emit('cell-update', { headerId, rowId, value: oldValue, type: header?.type })
      }
    }
  }

  /**
   * Create command for row delete
   * @param {number} rowId - Row ID that was deleted
   * @param {object} rowData - Full row data snapshot before deletion
   */
  const createRowDeleteCommand = (rowId, rowData) => {
    return {
      type: 'row-delete',
      data: { rowId, rowData },
      execute: () => {
        // Delete row (re-execute delete)
        emit('row-delete', rowId)
      },
      undo: () => {
        // Restore row
        console.log('[UndoRedo] Restoring row:', rowId, rowData)
        emit('row-restore', { id: rowId, ...rowData })
      }
    }
  }

  /**
   * Create command for paste operation
   * @param {Array} cells - Array of cells that were pasted: { headerId, rowId, value }
   * @param {Array} oldValues - Array of old cell values before paste
   */
  const createPasteCommand = (cells, oldValues) => {
    return {
      type: 'paste-range',
      data: { cells, oldValues },
      execute: () => {
        // Apply paste (re-execute paste)
        cells.forEach(({ headerId, rowId, value, type }) => {
          emit('cell-update', { headerId, rowId, value, type })
        })
      },
      undo: () => {
        // Restore old values
        oldValues.forEach(({ headerId, rowId, value, type }) => {
          emit('cell-update', { headerId, rowId, value, type })
        })
      }
    }
  }

  /**
   * Create command for clear cell operation
   * @param {string} headerId - Column ID
   * @param {number} rowId - Row ID
   * @param {*} oldValue - Previous cell value before clearing
   * @param {object} header - Column header metadata
   */
  const createClearCellCommand = (headerId, rowId, oldValue, header) => {
    return {
      type: 'clear-cell',
      data: { headerId, rowId, oldValue, headerType: header?.type },
      execute: () => {
        // Clear cell (set to null or empty)
        emit('cell-update', { headerId, rowId, value: null, type: header?.type })
      },
      undo: () => {
        // Restore old value
        emit('cell-update', { headerId, rowId, value: oldValue, type: header?.type })
      }
    }
  }

  /**
   * Keyboard shortcut handler for Undo/Redo
   */
  const handleUndoRedoShortcut = event => {
    // Ignore shortcuts if user is typing in an input/textarea (but not in contenteditable)
    const activeEl = document.activeElement
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !activeEl.hasAttribute('contenteditable')) {
      // Allow undo/redo in input fields too (don't block)
      // This was a previous restriction, but it's better to allow it everywhere
      // return
    }

    // Ctrl+Z or Cmd+Z (Mac) for Undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      undo()
      return
    }

    // Ctrl+Y or Cmd+Y for Redo
    // Also support Ctrl+Shift+Z or Cmd+Shift+Z (common alternative)
    if ((event.ctrlKey || event.metaKey) &&
        (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
      event.preventDefault()
      event.stopPropagation()
      redo()
      return
    }
  }

  /**
   * Clear history stack (useful after table reload or major operations)
   */
  const clearHistory = () => {
    historyStack.value = []
    historyIndex.value = -1
    console.log('[UndoRedo] History cleared')
  }

  /**
   * Get current undo/redo availability
   */
  const canUndo = () => historyIndex.value >= 0
  const canRedo = () => historyIndex.value < historyStack.value.length - 1

  // Setup keyboard shortcuts on mount
  onMounted(() => {
    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleUndoRedoShortcut, true)
    console.log('[UndoRedo] Keyboard shortcuts registered')
  })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleUndoRedoShortcut, true)
    console.log('[UndoRedo] Keyboard shortcuts unregistered')
  })

  return {
    // State
    historyStack,
    historyIndex,
    canUndo,
    canRedo,

    // Actions
    addToHistory,
    undo,
    redo,
    clearHistory,

    // Command factories
    createCellEditCommand,
    createRowDeleteCommand,
    createPasteCommand,
    createClearCellCommand
  }
}
