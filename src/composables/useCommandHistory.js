import { ref, computed } from 'vue'

/**
 * Command pattern interface
 * @typedef {Object} Command
 * @property {string} name - Name of the command for history display
 * @property {Function} execute - Execute the command
 * @property {Function} undo - Undo the command
 * @property {Function} redo - Redo the command (by default calls execute)
 */

/**
 * Composable for managing command history with undo/redo functionality
 * @param {Object} options - Configuration options
 * @param {number} options.maxHistorySize - Maximum number of commands to keep in history (default: 50)
 * @returns {Object} Command history manager
 */
export function useCommandHistory(options = {}) {
  const { maxHistorySize = 50 } = options

  // History stacks
  const undoStack = ref([])
  const redoStack = ref([])

  // Computed properties
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const historySize = computed(() => undoStack.value.length)

  /**
   * Get the history of executed commands
   * @returns {Array<{name: string, timestamp: Date}>}
   */
  const getHistory = computed(() =>
    undoStack.value.map(item => ({
      name: item.command.name,
      timestamp: item.timestamp
    }))
  )

  /**
   * Execute a command and add it to history
   * @param {Command} command - Command to execute
   */
  function executeCommand(command) {
    if (!command || typeof command.execute !== 'function' || typeof command.undo !== 'function') {
      console.error('Invalid command: must have execute() and undo() methods')
      return
    }

    try {
      // Execute the command
      command.execute()

      // Add to undo stack
      undoStack.value.push({
        command,
        timestamp: new Date()
      })

      // Limit history size
      if (undoStack.value.length > maxHistorySize) {
        undoStack.value.shift()
      }

      // Clear redo stack when new command is executed
      redoStack.value = []
    } catch (error) {
      console.error('Error executing command:', error)
      throw error
    }
  }

  /**
   * Undo the last command
   */
  function undo() {
    if (!canUndo.value) {
      console.warn('Nothing to undo')
      return
    }

    try {
      const item = undoStack.value.pop()
      item.command.undo()
      redoStack.value.push(item)
    } catch (error) {
      console.error('Error undoing command:', error)
      throw error
    }
  }

  /**
   * Redo the last undone command
   */
  function redo() {
    if (!canRedo.value) {
      console.warn('Nothing to redo')
      return
    }

    try {
      const item = redoStack.value.pop()
      const redoFn = item.command.redo || item.command.execute
      redoFn.call(item.command)
      undoStack.value.push(item)
    } catch (error) {
      console.error('Error redoing command:', error)
      throw error
    }
  }

  /**
   * Clear all history
   */
  function clear() {
    undoStack.value = []
    redoStack.value = []
  }

  /**
   * Get the last executed command name
   */
  const lastCommandName = computed(() => {
    const lastItem = undoStack.value[undoStack.value.length - 1]
    return lastItem ? lastItem.command.name : null
  })

  /**
   * Get the next command name that would be redone
   */
  const nextRedoCommandName = computed(() => {
    const nextItem = redoStack.value[redoStack.value.length - 1]
    return nextItem ? nextItem.command.name : null
  })

  return {
    // State
    canUndo,
    canRedo,
    historySize,
    lastCommandName,
    nextRedoCommandName,

    // Methods
    executeCommand,
    undo,
    redo,
    clear,
    getHistory
  }
}
