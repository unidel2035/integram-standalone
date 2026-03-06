/**
 * Composable for Event Engine Undo/Redo (Item 8)
 *
 * Provides undo/redo functionality for event-engine operations:
 * create-event, delete-event, update-constraint, move-node, create-individual
 */

import { ref, computed } from 'vue'

export function useEventEngineUndoRedo(api) {
  const undoStack = ref([])
  const redoStack = ref([])
  const maxStackSize = 50

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const lastOperations = computed(() => undoStack.value.slice(-10).reverse())

  function pushCommand(command) {
    undoStack.value.push(command)
    if (undoStack.value.length > maxStackSize) undoStack.value.shift()
    redoStack.value = [] // clear redo on new action
  }

  async function undo() {
    if (!canUndo.value) return null
    const command = undoStack.value.pop()
    try {
      await command.undo()
      redoStack.value.push(command)
      return command
    } catch (err) {
      // Re-push on failure
      undoStack.value.push(command)
      throw err
    }
  }

  async function redo() {
    if (!canRedo.value) return null
    const command = redoStack.value.pop()
    try {
      await command.execute()
      undoStack.value.push(command)
      return command
    } catch (err) {
      redoStack.value.push(command)
      throw err
    }
  }

  // ─── Command Factories ───────────────────────────────────────

  function createEventCommand(params) {
    let createdId = null
    return {
      type: 'create-event',
      description: `Создать событие "${params.name}"`,
      async execute() {
        const result = await api.post(`/individuals/${params.individualId}/events`, params)
        createdId = result.data?.data?.id || result.data?.data?.obj
        return createdId
      },
      async undo() {
        if (createdId) await api.delete(`/events/${createdId}`)
      },
    }
  }

  function deleteEventCommand(eventId, eventName) {
    return {
      type: 'delete-event',
      description: `Удалить событие "${eventName || eventId}"`,
      async execute() {
        await api.delete(`/events/${eventId}`)
      },
      async undo() {
        // Soft-delete is reversible: we'd need to un-delete
        // For now, this is one-way (soft-delete can't be undone via API)
      },
    }
  }

  function updateConstraintCommand(eventId, eventName, oldConstraints, newConstraints) {
    return {
      type: 'update-constraint',
      description: `Обновить ограничения "${eventName || eventId}"`,
      async execute() {
        await api.put(`/model-events/${eventId}`, { 'Ограничения': JSON.stringify(newConstraints) })
      },
      async undo() {
        await api.put(`/model-events/${eventId}`, { 'Ограничения': JSON.stringify(oldConstraints) })
      },
    }
  }

  function moveNodeCommand(eventId, eventName, oldParentId, newParentId) {
    return {
      type: 'move-node',
      description: `Переместить "${eventName || eventId}"`,
      async execute() {
        await api.put(`/model-events/${eventId}`, { 'Родитель': newParentId || '' })
      },
      async undo() {
        await api.put(`/model-events/${eventId}`, { 'Родитель': oldParentId || '' })
      },
    }
  }

  function createModelEventCommand(params) {
    let createdId = null
    return {
      type: 'create-model-event',
      description: `Добавить свойство "${params.name}"`,
      async execute() {
        const result = await api.post(`/models/${params.modelId}/events`, params)
        createdId = result.data?.data?.id || result.data?.data?.obj
        return createdId
      },
      async undo() {
        if (createdId) await api.delete(`/model-events/${createdId}`)
      },
    }
  }

  // ─── Execute with undo support ───────────────────────────────

  async function executeCommand(command) {
    const result = await command.execute()
    pushCommand(command)
    return result
  }

  // ─── Keyboard shortcuts ──────────────────────────────────────

  function handleKeydown(event) {
    const isCtrl = event.ctrlKey || event.metaKey
    if (isCtrl && event.key === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo().catch(() => {})
    } else if (isCtrl && event.key === 'z' && event.shiftKey) {
      event.preventDefault()
      redo().catch(() => {})
    } else if (isCtrl && event.key === 'y') {
      event.preventDefault()
      redo().catch(() => {})
    }
  }

  return {
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    lastOperations,
    undo,
    redo,
    pushCommand,
    executeCommand,
    handleKeydown,
    // Command factories
    createEventCommand,
    deleteEventCommand,
    updateConstraintCommand,
    moveNodeCommand,
    createModelEventCommand,
  }
}
